import { Request, Response } from 'express';
import { prisma } from '../prisma/prisma-client';
import Jdenticon from 'jdenticon';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import * as Minio from 'minio';

dotenv.config();

interface UpdateProfileBody {
  username?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
}

interface GetProfilesBatchBody {
  userIds: string[];
}

// Конфигурация MinIO из .env
const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
  bucketName: process.env.MINIO_BUCKET_NAME || 'public-bucket',
  accessKey: process.env.MINIO_WRITE_USER || 'write-user',
  secretKey: process.env.MINIO_WRITE_PASSWORD || 'write123',
  secure: false,
};

// Инициализируем клиент MinIO
const minioClient = new Minio.Client({
  endPoint: minioConfig.endpoint.split(':')[0],
  port: parseInt(minioConfig.endpoint.split(':')[1]) || 9000,
  useSSL: minioConfig.secure,
  accessKey: minioConfig.accessKey,
  secretKey: minioConfig.secretKey,
});

// Функция для загрузки файла в MinIO
async function uploadToMinIO(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const objectName = `avatars/${uniqueFileName}`;
    
    await minioClient.putObject(
      minioConfig.bucketName,
      objectName,
      buffer,
      buffer.length,
      { 'Content-Type': contentType }
    );
    
    const publicUrl = `http://${minioConfig.endpoint}/${minioConfig.bucketName}/${objectName}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to MinIO:', error);
    throw new Error('Failed to upload file');
  }
}

// Функция для удаления файла из MinIO
async function deleteFromMinIO(url: string): Promise<void> {
  try {
    const urlParts = url.split('/');
    const objectName = urlParts.slice(3).join('/');
    
    await minioClient.removeObject(minioConfig.bucketName, objectName);
  } catch (error) {
    console.error('Error deleting from MinIO:', error);
  }
}

const ProfileController = {
  // GET /profiles/{userId}
  getProfile: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const profile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (!profile) {
        res.status(404).json({ error: 'Профиль не найден' });
        return;
      }

      res.json(profile);
    } catch (error) {
      console.error('Get Profile Error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /profiles/me - создание профиля с дефолтной аватаркой в MinIO
  createMe: async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const { username, firstName, lastName, description } = req.body as UpdateProfileBody;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!username) {
      res.status(400).json({ error: 'Имя пользователя обязательно' });
      return;
    }

    try {
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (existingProfile) {
        res.status(400).json({ error: 'Профиль уже существует' });
        return;
      }

      const existingUsername = await prisma.profile.findFirst({
        where: { username }
      });

      if (existingUsername) {
        res.status(400).json({ error: 'Имя пользователя уже занято' });
        return;
      }

      // Генерируем дефолтную аватарку и загружаем в MinIO
      const pngBuffer = Buffer.from(Jdenticon.toPng(username, 200));
      const avatarName = `${username}_${Date.now()}.png`;
      
      const avatarUrl = await uploadToMinIO(
        pngBuffer,
        avatarName,
        'image/png'
      );

      const profile = await prisma.profile.create({
        data: {
          id: userId,
          username,
          firstName: firstName || null,
          lastName: lastName || null,
          description: description || null,
          avatarUrl
        }
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error('Error in createMe', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // PATCH /profiles/{userId}
  updateProfile: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { username, firstName, lastName, description } = req.body as UpdateProfileBody;

    if (!req.user || userId !== req.user.userId) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    try {
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (!existingProfile) {
        res.status(404).json({ error: 'Профиль не найден' });
        return;
      }

      if (username) {
        const profileWithSameUsername = await prisma.profile.findFirst({ 
          where: { username } 
        });

        if (profileWithSameUsername && profileWithSameUsername.id !== userId) {
          res.status(400).json({ error: 'Имя пользователя уже занято' });
          return;
        }
      }

      const updatedProfile = await prisma.profile.update({
        where: { id: userId },
        data: {
          username: username || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          description: description || undefined,
        }
      });

      res.json(updatedProfile);
    } catch (error) {
      console.error('Update profile error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /profiles/{userId}/avatar - обновление аватарки через MinIO
  updateAvatar: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (!req.user || userId !== req.user.userId) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    try {
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (!existingProfile) {
        res.status(404).json({ error: 'Профиль не найден' });
        return;
      }

      const avatarUrl = await uploadToMinIO(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (existingProfile.avatarUrl) {
        await deleteFromMinIO(existingProfile.avatarUrl);
      }

      const updatedProfile = await prisma.profile.update({
        where: { id: userId },
        data: { avatarUrl }
      });

      res.json({ avatarUrl: updatedProfile.avatarUrl });
    } catch (error) {
      console.error('Update avatar error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /profiles/search?query=Fek&limit=10
  searchProfiles: async (req: Request, res: Response): Promise<void> => {
    const { query, limit = '10' } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Запрос обязателен' });
      return;
    }

    const limitValue = typeof limit === 'string' ? limit : '10';

    try {
      const profiles = await prisma.profile.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ]
        },
        take: parseInt(limitValue, 10),
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        }
      });

      res.json(profiles);
    } catch (error) {
      console.error('Search profiles error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /profiles/batch
  getProfilesBatch: async (req: Request, res: Response): Promise<void> => {
    const { userIds } = req.body as GetProfilesBatchBody;

    if (!userIds || !Array.isArray(userIds)) {
      res.status(400).json({ error: 'Некорректный список идентификаторов' });
      return;
    }

    try {
      const profiles = await prisma.profile.findMany({
        where: {
          id: {
            in: userIds
          }
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        }
      });

      res.json(profiles);
    } catch (error) {
      console.error('Batch get profiles error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /profiles/me
  getMe: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ error: 'Не авторизован' });
        return;
      }

      const profile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (!profile) {
        res.status(404).json({ error: 'Профиль не найден' });
        return;
      }

      res.json(profile);

    } catch (error) {
      console.error('Get Current Profile Error', error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // PATCH /profiles/me
  updateMe: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ error: 'Не авторизован' });
        return;
      }

      const { username, firstName, lastName, description } = req.body;

      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (!existingProfile) {
        res.status(404).json({ error: 'Профиль не найден' });
        return;
      }

      if (username) {
        const profileWithSameUsername = await prisma.profile.findFirst({ 
          where: { username } 
        });

        if (profileWithSameUsername && profileWithSameUsername.id !== userId) {
          res.status(400).json({ error: 'Имя пользователя уже занято' });
          return;
        }
      }

      const updatedProfile = await prisma.profile.update({
        where: { id: userId },
        data: {
          username: username || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          description: description || undefined,
        }
      });

      res.json(updatedProfile);
    } catch (error) {
      console.error('Update Profile Error', error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // PATCH /profiles/me/avatar
  updateMyAvatar: async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    try {
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      if (!existingProfile) {
        res.status(404).json({ error: 'Профиль не найден' });
        return;
      }

      const avatarUrl = await uploadToMinIO(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (existingProfile.avatarUrl) {
        await deleteFromMinIO(existingProfile.avatarUrl);
      }

      const updatedProfile = await prisma.profile.update({
        where: { id: userId },
        data: { avatarUrl }
      });

      res.json({ avatarUrl: updatedProfile.avatarUrl });
    } catch (error) {
      console.error('Update avatar error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

export default ProfileController;
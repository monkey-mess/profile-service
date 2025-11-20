import { Request, Response } from 'express';
import { prisma } from '../prisma/prisma-client';
import path from 'path';
import fs from 'fs';
import Jdenticon from 'jdenticon';
import dotenv from 'dotenv';

dotenv.config();

interface CreateProfileBody {
  username: string;
  firstName?: string;
  lastName?: string;
  description?: string;
}

interface UpdateProfileBody {
  username?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
}

interface GetProfilesBatchBody {
  userIds: string[];
}

// Функция для создания папки uploads если её нет
function ensureUploadsDir(): void {
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
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

  // POST /profiles/{userId} - создание профиля с дефолтной аватаркой
  createProfile: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { username, firstName, lastName, description } = req.body as CreateProfileBody;

    if (!req.user || userId !== req.user.id) {
      res.status(403).json({ error: 'Нет доступа' });
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

      ensureUploadsDir();
      const png = Jdenticon.toPng(username, 200);
      const avatarName = `${username}_${Date.now()}.png`;
      const avatarPath = path.join(__dirname, '../uploads', avatarName);
      fs.writeFileSync(avatarPath, png);
      const avatarUrl = `/uploads/${avatarName}`;

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

      res.json(profile);
    } catch (error) {
      console.error('Error in createProfile', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // PATCH /profiles/{userId}
  updateProfile: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { username, firstName, lastName, description } = req.body as UpdateProfileBody;

    if (!req.user || userId !== req.user.id) {
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

  // POST /profiles/{userId}/avatar
  updateAvatar: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (!req.user || userId !== req.user.id) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    ensureUploadsDir();
    let filePath: string = req.file.path;
    filePath = filePath.replace(/\\/g, '/');
    const avatarUrl = `/${filePath}`;

    try {
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
  }
};

export default ProfileController;


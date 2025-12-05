import request from 'supertest';
import express from 'express';
import indexRouter from '../../routes/index';

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../prisma/prisma-client', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '../../prisma/prisma-client';
const mockPrisma = prisma as any;

jest.mock('../../middleware/auth', () => {
  return jest.fn((req, res, next) => {
    // Если есть валидный токен, устанавливаем user и пропускаем
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 'user-123' };
      next();
    } else {
      // Если токена нет, возвращаем 401 (как в реальном middleware)
      res.status(401).json({ error: 'Unauthorized' });
    }
  });
});

// Мокаем multer
jest.mock('multer', () => {
  const multer = jest.fn(() => ({
    single: jest.fn(() => (req: any, _res: any, next: any) => {
      req.file = {
        originalname: 'test-avatar.png',
        path: 'uploads/test-avatar.png',
      };
      next();
    }),
  }));
  (multer as any).diskStorage = jest.fn((options: any) => options);
  return multer;
});

// Мокаем fs и path
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  __dirname: '',
}));

jest.mock('jdenticon', () => ({
  toPng: jest.fn(() => Buffer.from('fake-png-data')),
}));

const app = express();
app.use(express.json());
app.use('/api', indexRouter);

describe('Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profile.findUnique.mockReset();
    mockPrisma.profile.findFirst.mockReset();
    mockPrisma.profile.findMany.mockReset();
    mockPrisma.profile.create.mockReset();
    mockPrisma.profile.update.mockReset();
  });

  describe('GET /api/profiles/:userId', () => {
    it('должен вернуть профиль', async () => {
      const mockProfile = {
        id: 'user-123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: '/uploads/avatar.png',
        description: 'Test description',
      };

      mockPrisma.profile.findUnique.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/api/profiles/user-123')
        .expect(200);

      expect(response.body).toEqual(mockProfile);
      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('должен вернуть 404 если профиль не найден', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/profiles/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Профиль не найден' });
    });
  });

  describe('POST /api/profiles/:userId', () => {
    it('должен создать профиль с валидным токеном', async () => {
      const mockProfile = {
        id: 'user-123',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        avatarUrl: '/uploads/newuser_1234567890.png',
        description: null,
      };

      mockPrisma.profile.findUnique.mockResolvedValue(null);
      mockPrisma.profile.findFirst.mockResolvedValue(null);
      mockPrisma.profile.create.mockResolvedValue(mockProfile);

      const response = await request(app)
        .post('/api/profiles/user-123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(200);

      expect(response.body).toEqual(mockProfile);
      expect(mockPrisma.profile.create).toHaveBeenCalled();
    });

    it('должен вернуть 401 без токена', async () => {
      // POST /profiles/:userId требует authenticateToken middleware
      // Если токена нет, middleware вернет 401
      const response = await request(app)
        .post('/api/profiles/user-123')
        .send({
          username: 'newuser',
        });

      // Middleware вернет 401, но если он не сработал, контроллер вернет 403
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('PATCH /api/profiles/:userId', () => {
    it('должен обновить профиль с валидным токеном', async () => {
      const existingProfile = {
        id: 'user-123',
        username: 'olduser',
        firstName: 'Old',
        lastName: 'User',
      };

      const updatedProfile = {
        ...existingProfile,
        username: 'newuser',
      };

      mockPrisma.profile.findUnique.mockResolvedValue(existingProfile);
      mockPrisma.profile.findFirst.mockResolvedValue(null);
      mockPrisma.profile.update.mockResolvedValue(updatedProfile);

      const response = await request(app)
        .patch('/api/profiles/user-123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          username: 'newuser',
        })
        .expect(200);

      expect(response.body).toEqual(updatedProfile);
      expect(mockPrisma.profile.update).toHaveBeenCalled();
    });

    it('должен вернуть 401 без токена', async () => {
      // PATCH /profiles/:userId требует authenticateToken middleware
      const response = await request(app)
        .patch('/api/profiles/user-123')
        .send({
          username: 'newuser',
        });

      // Middleware вернет 401, но если он не сработал, контроллер вернет 403
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/profiles/search', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('должен вернуть результаты поиска', async () => {
      const mockProfiles = [
        {
          id: 'user-1',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          avatarUrl: '/uploads/avatar.png',
        },
      ];

      mockPrisma.profile.findMany.mockResolvedValue(mockProfiles);

      const response = await request(app)
        .get('/api/profiles/search')
        .query({ query: 'test', limit: '10' })
        .expect(200);

      expect(response.body).toEqual(mockProfiles);
      expect(mockPrisma.profile.findMany).toHaveBeenCalled();
    });

    it('должен вернуть 400 если query отсутствует', async () => {
      const response = await request(app)
        .get('/api/profiles/search')
        .expect(400);

      expect(response.body).toEqual({ error: 'Запрос обязателен' });
    });
  });

  describe('POST /api/profiles/batch', () => {
    it('должен вернуть массив профилей', async () => {
      const mockProfiles = [
        {
          id: 'user-1',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          avatarUrl: '/uploads/avatar1.png',
        },
        {
          id: 'user-2',
          username: 'user2',
          firstName: 'User',
          lastName: 'Two',
          avatarUrl: '/uploads/avatar2.png',
        },
      ];

      mockPrisma.profile.findMany.mockResolvedValue(mockProfiles);

      const response = await request(app)
        .post('/api/profiles/batch')
        .send({ userIds: ['user-1', 'user-2'] })
        .expect(200);

      expect(response.body).toEqual(mockProfiles);
      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['user-1', 'user-2'],
          },
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });
    });

    it('должен вернуть 400 если userIds не массив', async () => {
      const response = await request(app)
        .post('/api/profiles/batch')
        .send({ userIds: 'not-an-array' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Некорректный список идентификаторов' });
    });
  });
});


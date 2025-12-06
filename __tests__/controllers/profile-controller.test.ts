import { Request, Response } from 'express';
import ProfileController from '../../controllers/profile-controller';

// Мокаем dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Мокаем Prisma клиент
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

// Мокаем fs и path
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

// Мокаем Jdenticon
jest.mock('jdenticon', () => ({
  toPng: jest.fn(() => Buffer.from('fake-png-data')),
}));

describe('ProfileController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: undefined,
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('должен вернуть профиль при успешном запросе', async () => {
      const mockProfile = {
        id: 'user-123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: '/uploads/avatar.png',
        description: 'Test description',
      };

      mockRequest.params = { userId: 'user-123' };
      mockPrisma.profile.findUnique.mockResolvedValue(mockProfile);

      await ProfileController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(statusMock).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockProfile);
    });

    it('должен вернуть 404 если профиль не найден', async () => {
      mockRequest.params = { userId: 'non-existent' };
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      await ProfileController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Профиль не найден' });
    });

    it('должен вернуть 500 при ошибке базы данных', async () => {
      mockRequest.params = { userId: 'user-123' };
      mockPrisma.profile.findUnique.mockRejectedValue(new Error('DB Error'));

      await ProfileController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  // describe('createProfile', () => {
  //   it('должен создать профиль при валидных данных', async () => {
  //     const mockProfile = {
  //       id: 'user-123',
  //       username: 'newuser',
  //       firstName: 'New',
  //       lastName: 'User',
  //       avatarUrl: '/uploads/newuser_1234567890.png',
  //       description: null,
  //     };

  //     mockRequest.params = { userId: 'user-123' };
  //     mockRequest.body = {
  //       username: 'newuser',
  //       firstName: 'New',
  //       lastName: 'User',
  //     };
  //     mockRequest.user = { userId: 'user-123' };

  //     mockPrisma.profile.findUnique.mockResolvedValue(null);
  //     mockPrisma.profile.findFirst.mockResolvedValue(null);
  //     mockPrisma.profile.create.mockResolvedValue(mockProfile);

  //     await ProfileController.createProfile(
  //       mockRequest as Request,
  //       mockResponse as Response
  //     );

  //     expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
  //       where: { id: 'user-123' },
  //     });
  //     expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
  //       where: { username: 'newuser' },
  //     });
  //     expect(mockPrisma.profile.create).toHaveBeenCalled();
  //     expect(jsonMock).toHaveBeenCalledWith(mockProfile);
  //   });

  //   it('должен вернуть 403 если userId не совпадает с user.id', async () => {
  //     mockRequest.params = { userId: 'user-123' };
  //     mockRequest.body = { username: 'newuser' };
  //     mockRequest.user = { userId: 'different-user' };

  //     await ProfileController.createProfile(
  //       mockRequest as Request,
  //       mockResponse as Response
  //     );

  //     expect(statusMock).toHaveBeenCalledWith(403);
  //     expect(jsonMock).toHaveBeenCalledWith({ error: 'Нет доступа' });
  //   });

  //   it('должен вернуть 400 если username не указан', async () => {
  //     mockRequest.params = { userId: 'user-123' };
  //     mockRequest.body = {};
  //     mockRequest.user = { userId: 'user-123' };

  //     await ProfileController.createProfile(
  //       mockRequest as Request,
  //       mockResponse as Response
  //     );

  //     expect(statusMock).toHaveBeenCalledWith(400);
  //     expect(jsonMock).toHaveBeenCalledWith({ error: 'Имя пользователя обязательно' });
  //   });

  //   it('должен вернуть 400 если профиль уже существует', async () => {
  //     mockRequest.params = { userId: 'user-123' };
  //     mockRequest.body = { username: 'existinguser' };
  //     mockRequest.user = { userId: 'user-123' };

  //     mockPrisma.profile.findUnique.mockResolvedValue({ id: 'user-123' });

  //     await ProfileController.createProfile(
  //       mockRequest as Request,
  //       mockResponse as Response
  //     );

  //     expect(statusMock).toHaveBeenCalledWith(400);
  //     expect(jsonMock).toHaveBeenCalledWith({ error: 'Профиль уже существует' });
  //   });

  //   it('должен вернуть 400 если username уже занят', async () => {
  //     mockRequest.params = { userId: 'user-123' };
  //     mockRequest.body = { username: 'takenuser' };
  //     mockRequest.user = { userId: 'user-123' };

  //     mockPrisma.profile.findUnique.mockResolvedValue(null);
  //     mockPrisma.profile.findFirst.mockResolvedValue({ id: 'other-user' });

  //     await ProfileController.createProfile(
  //       mockRequest as Request,
  //       mockResponse as Response
  //     );

  //     expect(statusMock).toHaveBeenCalledWith(400);
  //     expect(jsonMock).toHaveBeenCalledWith({ error: 'Имя пользователя уже занято' });
  //   });
  // });

  describe('updateProfile', () => {
    it('должен обновить профиль при валидных данных', async () => {
      const existingProfile = {
        id: 'user-123',
        username: 'olduser',
        firstName: 'Old',
        lastName: 'User',
      };

      const updatedProfile = {
        ...existingProfile,
        username: 'newuser',
        firstName: 'New',
      };

      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = {
        username: 'newuser',
        firstName: 'New',
      };
      mockRequest.user = { userId: 'user-123' };

      mockPrisma.profile.findUnique.mockResolvedValue(existingProfile);
      mockPrisma.profile.findFirst.mockResolvedValue(null);
      mockPrisma.profile.update.mockResolvedValue(updatedProfile);

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.profile.update).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(updatedProfile);
    });

    it('должен вернуть 403 если userId не совпадает с user.id', async () => {
      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = { username: 'newuser' };
      mockRequest.user = { userId: 'different-user' };

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Нет доступа' });
    });

    it('должен вернуть 404 если профиль не найден', async () => {
      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = { username: 'newuser' };
      mockRequest.user = { userId: 'user-123' };

      mockPrisma.profile.findUnique.mockResolvedValue(null);

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Профиль не найден' });
    });
  });

  describe('searchProfiles', () => {
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

      mockRequest.query = { query: 'test', limit: '10' };
      mockPrisma.profile.findMany.mockResolvedValue(mockProfiles);

      await ProfileController.searchProfiles(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.profile.findMany).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockProfiles);
    });

    it('должен вернуть 400 если query не указан', async () => {
      mockRequest.query = {};

      await ProfileController.searchProfiles(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Запрос обязателен' });
    });
  });

  describe('getProfilesBatch', () => {
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

      mockRequest.body = { userIds: ['user-1', 'user-2'] };
      mockPrisma.profile.findMany.mockResolvedValue(mockProfiles);

      await ProfileController.getProfilesBatch(
        mockRequest as Request,
        mockResponse as Response
      );

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
      expect(jsonMock).toHaveBeenCalledWith(mockProfiles);
    });

    it('должен вернуть 400 если userIds не массив', async () => {
      mockRequest.body = { userIds: 'not-an-array' };

      await ProfileController.getProfilesBatch(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Некорректный список идентификаторов' });
    });

    it('должен вернуть 400 если userIds отсутствует', async () => {
      mockRequest.body = {};

      await ProfileController.getProfilesBatch(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Некорректный список идентификаторов' });
    });
  });
});


const { prisma } = require("../prisma/prisma-client");
const path = require('path');
const fs = require('fs');
const Jdenticon = require('jdenticon');
require('dotenv').config();

// Функция для создания папки uploads если её нет
function ensureUploadsDir() {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
}

const ProfileController = {
    // GET /profiles/{userId}
    getProfile: async (req, res) => {
        const { userId } = req.params;

        try {
            const profile = await prisma.profile.findUnique({
                where: { id: userId }
            });

            if (!profile) {
                return res.status(404).json({ error: 'Профиль не найден' });
            }

            res.json(profile);
        } catch (error) {
            console.error('Get Profile Error', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // POST /profiles/{userId} - создание профиля с дефолтной аватаркой
    createProfile: async (req, res) => {
        const { userId } = req.params;
        const { username, firstName, lastName, description } = req.body;

        if (userId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        if (!username) {
            return res.status(400).json({ error: 'Имя пользователя обязательно' });
        }

        try {
            const existingProfile = await prisma.profile.findUnique({
                where: { id: userId }
            });

            if (existingProfile) {
                return res.status(400).json({ error: 'Профиль уже существует' });
            }

            const existingUsername = await prisma.profile.findFirst({
                where: { username }
            });

            if (existingUsername) {
                return res.status(400).json({ error: 'Имя пользователя уже занято' });
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
    updateProfile: async (req, res) => {
        const { userId } = req.params;
        const { username, firstName, lastName, description } = req.body;

        if (userId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        try {
            const existingProfile = await prisma.profile.findUnique({
                where: { id: userId }
            });

            if (!existingProfile) {
                return res.status(404).json({ error: 'Профиль не найден' });
            }

            if (username) {
                const profileWithSameUsername = await prisma.profile.findFirst({ 
                    where: { username } 
                });

                if (profileWithSameUsername && profileWithSameUsername.id !== userId) {
                    return res.status(400).json({ error: 'Имя пользователя уже занято' });
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
    searchProfiles: async (req, res) => {
        const { query, limit = 10 } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Запрос обязателен' });
        }

        try {
            const profiles = await prisma.profile.findMany({
                where: {
                    OR: [
                        { username: { contains: query, mode: 'insensitive' } },
                        { firstName: { contains: query, mode: 'insensitive' } },
                        { lastName: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: parseInt(limit),
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
    updateAvatar: async (req, res) => {
        const { userId } = req.params;

        if (userId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        ensureUploadsDir();
        let filePath = req.file.path;
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
    getProfilesBatch: async (req, res) => {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ error: 'Некорректный список идентификаторов' });
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

module.exports = ProfileController;
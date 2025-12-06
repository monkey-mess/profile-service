import express from 'express';
import multer from 'multer';
import { ProfileController } from '../controllers';
import authenticateToken from '../middleware/auth';

const router = express.Router();

const uploadDestination = 'uploads';

// Показываем где хранить файлы
const storage = multer.diskStorage({
  destination: uploadDestination,
  filename: function(_req, file, next) {
    next(null, file.originalname);
  }
});

const uploads = multer({ storage: storage });

// Профильные пути
// ВАЖНО: Статические роуты должны быть зарегистрированы ПЕРЕД динамическими
router.get('/profiles/search', ProfileController.searchProfiles);
router.post('/profiles/batch', ProfileController.getProfilesBatch);
router.get('/profiles/:userId', ProfileController.getProfile);
router.post('/profiles/me', authenticateToken, ProfileController.createMe);
router.get('/profiles/me', authenticateToken, ProfileController.getMe);
router.patch('/profiles/me', authenticateToken, ProfileController.updateMe);
router.patch('/profiles/:userId', authenticateToken, ProfileController.updateProfile);
router.post('/profiles/:userId/avatar', authenticateToken, uploads.single('avatar'), ProfileController.updateAvatar);

export default router;


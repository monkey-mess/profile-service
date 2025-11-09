const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ProfileController } = require('../controllers');
const authenticateToken = require('../middleware/auth');

const uploadDestination = 'uploads'

// Показываем где хранить файлы
const storage = multer.diskStorage({
    destination: uploadDestination,
    filename: function(req, file, next){
        next(null, file.originalname)
    }
})

const uploads = multer({ storage: storage })

// Профильные пути
router.get('/profiles/:userId', ProfileController.getProfile);
router.post('/profiles/:userId', authenticateToken, ProfileController.createProfile);
router.patch('/profiles/:userId', authenticateToken, ProfileController.updateProfile);
router.get('/profiles/search', ProfileController.searchProfiles);
router.post('/profiles/:userId/avatar', authenticateToken, uploads.single('avatar'), ProfileController.updateAvatar);
router.post('/profiles/batch', ProfileController.getProfilesBatch);

module.exports = router;
/**
 * Image Upload Routes
 * Handles vehicle photos and document uploads to Supabase Storage
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { createError } from '../utils/error';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, HEIC, and PDF are allowed.'));
    }
  },
});

// POST /api/upload/image - Upload single file
router.post('/image', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError('No file provided', 400, 'NO_FILE');
    }

    const userId = req.user!.id;
    const file = req.file;
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${userId}/${timestamp}_${sanitizedName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('shipment-photos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw createError(`Upload failed: ${error.message}`, 500, 'UPLOAD_FAILED');
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('shipment-photos')
      .getPublicUrl(data.path);

    res.json({
      success: true,
      url: publicUrl,
      path: data.path,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/upload/vehicle-photos - Upload multiple photos
router.post('/vehicle-photos', authenticate, upload.array('photos', 6), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw createError('No files provided', 400, 'NO_FILES');
    }

    const userId = req.user!.id;
    const positions = ['front', 'rear', 'left', 'right', 'interior', 'damage'];
    const uploadedPhotos: Array<{ position: string; url: string; path: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      
      const position = positions[i] || `extra_${i}`;
      const timestamp = Date.now();
      const ext = file.mimetype.split('/')[1] || 'jpg';
      const fileName = `${userId}/vehicle_${position}_${timestamp}.${ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from('shipment-photos')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        logger.error('Failed to upload photo', { error, userId, position });
        continue;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('shipment-photos')
        .getPublicUrl(data.path);

      uploadedPhotos.push({ position, url: publicUrl, path: data.path });
    }

    res.json({
      success: true,
      photos: uploadedPhotos,
      uploaded: uploadedPhotos.length,
      total: files.length,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/upload - Delete uploaded file (path in query string)
router.delete('/', authenticate, async (req, res, next) => {
  try {
    const filePath = req.query['path'] as string;
    
    if (!filePath) {
      throw createError('File path is required', 400, 'NO_PATH');
    }

    const userId = req.user!.id;
    const decodedPath = decodeURIComponent(filePath);

    if (!decodedPath.startsWith(`${userId}/`)) {
      throw createError('Unauthorized to delete this file', 403, 'FORBIDDEN');
    }

    const { error } = await supabaseAdmin.storage
      .from('shipment-photos')
      .remove([decodedPath]);

    if (error) {
      throw createError(`Delete failed: ${error.message}`, 500, 'DELETE_FAILED');
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { Jimp, JimpMime } from '../../src/jimp.js';
import { createRequire } from 'module';
import { AVATAR_HEIGHT, AVATAR_WIDTH } from '../../src/constants.js';
import { invalidateThumbnail } from '../../src/endpoints/thumbnails.js';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const characterCardParser = await import('../../src/character-card-parser.js');
const writeFileAtomicSync = require('write-file-atomic').sync;

/**
 * Replaces the character's avatar image while retaining internal V1/V2 JSON metadata.
 * 
 * @param {string|Buffer} uploadPath Path to the newly uploaded image or Buffer
 * @param {Object} req Express request object
 * @param {Object|undefined} crop Crop and resize parameters
 */
async function replaceAvatar(uploadPath, req, crop = undefined) {
    try {
        const imagePath = path.join(req.user.directories.characters, req.body.avatar_url);
        
        // Extract metadata from the old image
        const charData = await characterCardParser.parse(imagePath);

        // Invalidate old thumbnail cache
        invalidateThumbnail(req.user.directories, 'avatar', req.body.avatar_url);
        
        function getInputImage() {
            if (Buffer.isBuffer(uploadPath)) {
                return parseImageBuffer(uploadPath, crop);
            }
            return tryReadImage(uploadPath, crop);
        }

        // Read and optionally crop/resize the new image
        const inputImage = await getInputImage();
        
        // Inject original metadata into the new image
        const outputImage = characterCardParser.write(inputImage, charData);

        // Safely overwrite the character file
        await writeFileAtomicSync(imagePath, outputImage);
    } catch (err) {
        console.error('[AvatarEdit] Error replacing avatar:', err);
        throw err; // Throw to trigger 500 response in the router
    }
}

/**
 * Parses an image buffer and applies crop/resize if defined.
 */
async function parseImageBuffer(buffer, crop) {
    const image = await Jimp.read(buffer);
    let finalWidth = image.bitmap.width, finalHeight = image.bitmap.height;

    if (typeof crop == 'object' &&[crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
        image.crop(crop.x, crop.y, crop.width, crop.height);
        if (crop.want_resize) {
            finalWidth = AVATAR_WIDTH;
            finalHeight = AVATAR_HEIGHT;
        } else {
            finalWidth = crop.width;
            finalHeight = crop.height;
        }
    }

    image.cover({ w: finalWidth, h: finalHeight });
    return await image.getBuffer(JimpMime.png);
}

/**
 * Reads an image file and applies crop/resize if defined.
 */
async function tryReadImage(imgPath, crop) {
    try {
        let rawImg = await Jimp.read(imgPath);
        let finalWidth = rawImg.bitmap.width, finalHeight = rawImg.bitmap.height;

        if (typeof crop == 'object' &&[crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
            if (crop.want_resize) {
                finalWidth = AVATAR_WIDTH;
                finalHeight = AVATAR_HEIGHT;
            } else {
                finalWidth = crop.width;
                finalHeight = crop.height;
            }
        }

        rawImg.cover({ w: finalWidth, h: finalHeight });
        return await rawImg.getBuffer(JimpMime.png);
    } catch {
        // Fallback for unsupported image types (e.g. APNG)
        return fs.readFileSync(imgPath);
    }
}

/**
 * Safely parses a JSON string.
 */
function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return undefined;
    }
}

/**
 * Initializes plugin endpoints.
 * @param {Router} router Express Router
 */
export async function init(router) {
    router.post('/edit-avatar', async function (req, res) {
        try {
            if (!req.body || !req.file) {
                return res.status(400).send('Error: no response body and/or file detected');
            }

            const crop = tryParse(req.query.crop);
            const uploadPath = path.join(req.file.destination, req.file.filename);

            await replaceAvatar(uploadPath, req, crop);
            
            // Clean up the temporary uploaded file
            if (fs.existsSync(uploadPath)) {
                fs.unlinkSync(uploadPath);
            }

            return res.sendStatus(200);
        } catch (err) {
            console.error('[AvatarEdit] Critical error during avatar replacement:', err);
            
            // Ensure temp file is cleaned up even on failure
            if (req.file) {
                const uploadPath = path.join(req.file.destination, req.file.filename);
                if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
            }
            
            return res.sendStatus(500);
        }
    });
}

export async function exit() {}

const module = {
    init,
    exit,
    info: {
        id: 'avataredit',
        name: 'AvatarEdit (Minimal)',
        description: 'A clean, stripped-down plugin to edit character avatars.',
    },
};
export default module;

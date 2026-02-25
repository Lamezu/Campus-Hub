import axios from 'axios';

const CLOUDINARY_CLOUD_NAME = 'dcwzlpg7m';
const CLOUDINARY_UPLOAD_PRESET = 'campushub-profiles';
const CLOUDINARY_FOLDER = 'campushub/profiles';

/**
 * Uploads a file to Cloudinary
 * @param uri Local file URI
 * @param userId Optional user identifier for filename
 * @returns Cloudinary response data
 */
export async function uploadToCloudinary(uri: string, userId?: string): Promise<any> {
    try {
        const formData = new FormData();
        const filename = userId ? `profile_${userId}_${Date.now()}.jpg` : `upload_${Date.now()}.jpg`;

        formData.append('file', {
            uri,
            type: 'image/jpeg',
            name: filename,
        } as any);

        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', CLOUDINARY_FOLDER);

        const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

        const response = await axios.post(endpoint, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        if (response.data && response.data.secure_url) {
            return response.data;
        } else {
            throw new Error('Cloudinary response missing secure_url');
        }
    } catch (error: any) {
        const errorMessage = error?.response?.data?.error?.message
            || error.message
            || 'Unknown error uploading to Cloudinary';

        throw new Error(`Upload failed: ${errorMessage}`);
    }
}


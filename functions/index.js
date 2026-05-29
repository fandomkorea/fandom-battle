const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp({
  databaseURL: 'https://fandom-battle-92aa8-default-rtdb.firebaseio.com'
});
const db = admin.database();

const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');

/**
 * Cloudinary 이미지 삭제 — 게시글 삭제 시 프론트에서 호출
 */
exports.deleteCloudinaryImage = onCall(
  { secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET] },
  async (request) => {
    const { publicId } = request.data;

    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    if (!publicId) {
      throw new HttpsError('invalid-argument', 'publicId가 필요합니다.');
    }

    try {
      const cloudinaryCloudName = 'dhkgabcme';
      const apiKey = CLOUDINARY_API_KEY.value();
      const apiSecret = CLOUDINARY_API_SECRET.value();
      const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`,
        { public_id: publicId, api_key: apiKey },
        { headers: { Authorization: `Basic ${authString}` } }
      );

      console.log(`✅ Cloudinary 이미지 삭제 완료: ${publicId}`);
      return { success: true, publicId, result: response.data.result };
    } catch (error) {
      console.error('❌ Cloudinary 이미지 삭제 실패:', error.message);
      if (error.response?.data?.error?.message?.includes('not found')) {
        return { success: true, message: '이미지가 이미 삭제되었거나 존재하지 않습니다.' };
      }
      throw new HttpsError('internal', `Cloudinary 삭제 실패: ${error.message}`);
    }
  }
);


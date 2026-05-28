const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Firebase 초기화
admin.initializeApp({
  databaseURL: 'https://fandom-battle-92aa8-default-rtdb.firebaseio.com'
});
const db = admin.database();

/**
 * Cloudinary 이미지 삭제 Cloud Function
 * 게시물 삭제 시 호출되어 Cloudinary의 이미지도 함께 삭제
 */
exports.deleteCloudinaryImage = functions.https.onCall(async (data, context) => {
  const { publicId } = data;

  // 인증 확인 (로그인한 사용자만)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '로그인이 필요합니다.'
    );
  }

  if (!publicId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'publicId가 필요합니다.'
    );
  }

  try {
    // Cloudinary 설정 (환경변수에서 읽음)
    const cloudinaryCloudName = 'dhkgabcme';
    const cloudinaryApiKey = functions.config().cloudinary?.api_key;
    const cloudinaryApiSecret = functions.config().cloudinary?.api_secret;

    if (!cloudinaryApiKey || !cloudinaryApiSecret) {
      console.error('❌ Cloudinary 환경변수가 설정되지 않았습니다');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cloudinary 설정이 필요합니다.'
      );
    }

    // Cloudinary Destroy API 호출
    const authString = Buffer.from(
      `${cloudinaryApiKey}:${cloudinaryApiSecret}`
    ).toString('base64');

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`,
      {
        public_id: publicId,
        api_key: cloudinaryApiKey
      },
      {
        headers: {
          'Authorization': `Basic ${authString}`
        }
      }
    );

    console.log(`✅ Cloudinary 이미지 삭제 완료: ${publicId}`);

    return {
      success: true,
      publicId: publicId,
      result: response.data.result
    };
  } catch (error) {
    console.error('❌ Cloudinary 이미지 삭제 실패:', error.message);

    // 이미지가 이미 삭제된 경우도 성공으로 처리
    if (error.response?.data?.error?.message?.includes('not found')) {
      return {
        success: true,
        message: '이미지가 이미 삭제되었거나 존재하지 않습니다.'
      };
    }

    throw new functions.https.HttpsError(
      'internal',
      `Cloudinary 삭제 실패: ${error.message}`
    );
  }
});

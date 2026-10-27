/** Keep multipart requests below serverless platforms' whole-body limits. */
export const MAX_UPLOAD_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_MULTIPART_BODY_BYTES = MAX_UPLOAD_FILE_BYTES + 64 * 1024;

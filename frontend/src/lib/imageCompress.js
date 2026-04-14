/**
 * Client-side image compression using <canvas>.
 * Reduces images to ~100-150KB before upload to Cloudinary.
 */

/**
 * Compress an image file to a target size.
 * @param {File} file - Original image file
 * @param {number} maxSizeKB - Target max size in KB (default 150)
 * @param {number} maxDimension - Max width/height in px (default 512)
 * @returns {Promise<Blob>} Compressed image blob
 */
export async function compressImage(file, maxSizeKB = 150, maxDimension = 512) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                // Scale down if exceeds maxDimension
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Iteratively reduce quality until under maxSizeKB
                let quality = 0.9;
                const maxBytes = maxSizeKB * 1024;

                const tryCompress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error("Canvas compression failed"));
                                return;
                            }
                            if (blob.size <= maxBytes || quality <= 0.1) {
                                resolve(blob);
                            } else {
                                quality -= 0.1;
                                tryCompress();
                            }
                        },
                        "image/jpeg",
                        quality
                    );
                };

                tryCompress();
            };

            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

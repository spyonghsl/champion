const MAX_HEIGHT = 180
const JPEG_QUALITY = 0.75
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function resizeSelfie(file: File): Promise<Blob> {
    if (!ACCEPTED_TYPES.includes(file.type)) {
        throw new Error('Choose a JPEG, PNG, or WebP image for your selfie.')
    }

    let image: ImageBitmap
    try {
        image = await createImageBitmap(file)
    } catch {
        throw new Error('This image could not be opened. Choose another photo.')
    }

    try {
        const scale = Math.min(1, MAX_HEIGHT / image.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))

        const context = canvas.getContext('2d')
        if (!context) throw new Error('Image processing is unavailable in this browser.')

        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('Could not prepare the selfie. Try another photo.')),
                'image/jpeg',
                JPEG_QUALITY,
            )
        })
    } finally {
        image.close()
    }
}
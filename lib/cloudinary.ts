export async function uploadToCloudinary(
  file: File | Blob,
  cloudName: string,
  uploadPreset: string
): Promise<{ url: string; publicId: string }> {
  return uploadToCloudinaryProgress(file, cloudName, uploadPreset, () => {})
}

// Envoi avec progression réelle (XMLHttpRequest) pour afficher une barre.
export function uploadToCloudinaryProgress(
  file: File | Blob,
  cloudName: string,
  uploadPreset: string,
  onProgress: (ratio: number) => void
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    formData.append('folder', 'galerie-mc')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText)
        resolve({
          url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${data.public_id}`,
          publicId: data.public_id,
        })
      } else {
        reject(new Error('upload-failed'))
      }
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(formData)
  })
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Réduit les grosses photos de téléphone dans le navigateur avant l'envoi.
// Renvoie le fichier d'origine s'il est déjà léger ou si la réduction n'aide pas.
export async function compressImage(file: File, maxDim = 2400, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) return file

    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', quality)
    )
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export function isTooBig(file: Blob): boolean {
  return file.size > MAX_UPLOAD_BYTES
}

export function getCloudinarySettings(): { cloudName: string; uploadPreset: string } | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (cloudName && uploadPreset) {
    return { cloudName, uploadPreset }
  }

  return null
}

export function getOptimizedUrl(url: string, width?: number): string {
  if (!url || !url.includes('cloudinary')) return url

  const parts = url.split('/upload/')
  if (parts.length !== 2) return url

  const transforms = width
    ? `f_auto,q_auto,w_${width}`
    : 'f_auto,q_auto'

  return `${parts[0]}/upload/${transforms}/${parts[1]}`
}

export function getResponsiveUrl(publicId: string, cloudName: string, width: number): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width},c_limit/${publicId}`
}

export async function testCloudinaryConnection(
  cloudName: string,
  uploadPreset: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: JSON.stringify({
          file: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
          upload_preset: uploadPreset
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    )
    return res.ok
  } catch {
    return false
  }
}

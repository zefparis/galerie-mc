export async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string
): Promise<{ url: string; publicId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'galerie-mc')

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) throw new Error('Upload Cloudinary échoué')

  const data = await res.json()
  return {
    url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${data.public_id}`,
    publicId: data.public_id
  }
}

export function getCloudinarySettings(): { cloudName: string; uploadPreset: string } | null {
  // Priorité 1 : variables d'environnement (Vercel)
  const envCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const envPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (envCloudName && envPreset) {
    return { cloudName: envCloudName, uploadPreset: envPreset }
  }

  // Priorité 2 : localStorage (fallback local dev)
  try {
    const raw = localStorage.getItem('mc-gallery-settings-v1')
    if (!raw) return null
    const settings = JSON.parse(raw)
    const { cloudinaryCloudName, cloudinaryUploadPreset } = settings || {}
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) return null
    return { cloudName: cloudinaryCloudName, uploadPreset: cloudinaryUploadPreset }
  } catch { return null }
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

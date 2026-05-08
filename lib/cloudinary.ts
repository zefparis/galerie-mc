export async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string
): Promise<{ url: string; publicId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }
    )

    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`Erreur Cloudinary: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    return {
      url: data.secure_url,
      publicId: data.public_id,
    }
  } catch (error: unknown) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("L'upload a pris trop de temps (10s). Vérifiez votre connexion.")
    }
    throw error
  }
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

export async function testCloudinaryConnection(
  cloudName: string,
  uploadPreset: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: (() => {
          const fd = new FormData()
          fd.append('file', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
          fd.append('upload_preset', uploadPreset)
          return fd
        })(),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

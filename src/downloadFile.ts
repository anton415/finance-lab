type DownloadFile = {
  content: string
  mimeType: string
  filename: string
}

export const downloadFile = ({ content, mimeType, filename }: DownloadFile) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  let link: HTMLAnchorElement | undefined
  let requested = false

  try {
    link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    requested = true
  } finally {
    link?.remove()
    if (requested) {
      // Give the browser time to consume the URL before releasing its Blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      URL.revokeObjectURL(url)
    }
  }
}

import { supabase } from './supabase'

// Compressor de imagem (usar sharp-like, aqui vamos usar canvas API)
async function comprimirImagem(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Redimensionar se necessário
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Converter para blob com qualidade
        canvas.toBlob(
          (blob) => resolve(blob),
          file.type || 'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Erro ao carregar imagem'))
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
  })
}

export async function uploadImagem(file, caminhoStorage = 'questoes') {
  // Validar tipo
  if (!file.type.startsWith('image/')) {
    throw new Error('Apenas imagens são permitidas')
  }

  // Validar tamanho (máx 5 MB antes de comprimir)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Imagem muito grande (máx 5 MB)')
  }

  try {
    // Comprimir imagem
    const imagemComprimida = await comprimirImagem(file, 1200, 1200, 0.8)
    
    // Gerar nome único
    const timestamp = Date.now()
    const nomeOriginal = file.name.split('.')[0]
    const extensao = file.type.split('/')[1]
    const nomeArquivo = `${caminhoStorage}/${nomeOriginal}-${timestamp}.${extensao}`

    // Upload para Supabase
    const { data, error } = await supabase.storage
      .from('midia')
      .upload(nomeArquivo, imagemComprimida, {
        contentType: file.type,
        upsert: false,
      })

    if (error) throw error

    // Obter URL pública
    const { data: publicUrl } = supabase.storage
      .from('midia')
      .getPublicUrl(nomeArquivo)

    return {
      url: publicUrl.publicUrl,
      path: nomeArquivo,
      tamanho: imagemComprimida.size,
    }
  } catch (err) {
    throw new Error(`Erro ao fazer upload: ${err.message}`)
  }
}

// Deletar imagem
export async function deletarImagem(caminhoArquivo) {
  const { error } = await supabase.storage
    .from('midia')
    .remove([caminhoArquivo])
  
  if (error) throw error
}

// Listar imagens de um usuário (para galeria)
export async function listarImagensUsuario(usuario_id) {
  const { data, error } = await supabase.storage
    .from('midia')
    .list(`questoes/`, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })

  if (error) throw error
  return data.map(file => ({
    nome: file.name,
    tamanho: file.metadata?.size,
    url: supabase.storage.from('midia').getPublicUrl(`questoes/${file.name}`).data.publicUrl,
  }))
}

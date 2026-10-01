export interface Product {
  product_id: string
  name: string
  garment_type: string
  category: string
  description: string
  colors: string[]
  price: number
  image_url: string
  inventory?: SizeStock[]
  on_sale?: boolean
  original_price?: number
}

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductDetail extends Product {
  inventory: SizeStock[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products: ProductDetail[]
  page?: PageResults | null
}

export interface PageResults {
  title: string
  query: string
  products: ProductDetail[]
}

export interface ChatResponse {
  reply: string
  products: ProductDetail[]
  page: PageResults | null
  tools_used: string[]
}

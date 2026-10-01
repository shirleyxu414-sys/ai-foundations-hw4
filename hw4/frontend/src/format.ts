const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const formatPrice = (n: number) => usd.format(n)

export const LOW_STOCK = 3

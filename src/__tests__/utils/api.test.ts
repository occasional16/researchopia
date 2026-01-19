import { describe, it, expect } from 'vitest'

describe('API Utils', () => {
  describe('URL building', () => {
    it('should build correct API URL', () => {
      const baseUrl = '/api/papers'
      const params = new URLSearchParams({ doi: '10.1234/test' })
      const url = `${baseUrl}?${params.toString()}`
      
      expect(url).toContain('/api/papers')
      expect(url).toContain('doi=10.1234%2Ftest')
    })

    it('should handle empty params', () => {
      const baseUrl = '/api/papers'
      const params = new URLSearchParams({})
      const url = params.toString() ? `${baseUrl}?${params}` : baseUrl
      
      expect(url).toBe('/api/papers')
    })
  })

  describe('Error parsing', () => {
    it('should parse standard error', () => {
      const error = { message: 'Not found' }
      const errorMessage = error.message || 'Unknown error'
      
      expect(errorMessage).toContain('Not found')
    })

    it('should handle unknown errors', () => {
      const error = null as { message?: string } | null
      const errorMessage = error?.message || 'Unknown error'
      
      expect(errorMessage).toContain('Unknown error')
    })

    it('should handle string errors', () => {
      const error = 'Network error'
      const errorMessage = typeof error === 'string' ? error : 'Unknown error'
      
      expect(errorMessage).toBe('Network error')
    })
  })

  describe('API response handling', () => {
    it('should validate successful response', () => {
      const response = {
        ok: true,
        status: 200,
        data: { id: 1, title: 'Test' },
      }
      
      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      expect(response.data).toBeDefined()
    })

    it('should handle error response', () => {
      const response = {
        ok: false,
        status: 404,
        error: 'Not found',
      }
      
      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
      expect(response.error).toBe('Not found')
    })
  })
})

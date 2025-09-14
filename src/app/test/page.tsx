'use client'

export default function TestPage() {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>
        🟢 测试页面 - VSCode Simple Browser
      </h1>
      <p style={{ color: '#666', fontSize: '18px' }}>
        如果你能看到这个页面，说明VSCode Simple Browser工作正常！
      </p>
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#d4edda',
        border: '1px solid #c3e6cb',
        borderRadius: '5px',
        color: '#155724'
      }}>
        ✅ 页面加载成功
      </div>
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => alert('JavaScript工作正常!')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          测试JavaScript
        </button>
      </div>
    </div>
  )
}
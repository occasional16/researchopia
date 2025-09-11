import AddPaperForm from '@/components/papers/AddPaperForm'
import DOISearch from '@/components/papers/DOISearch'

export default function NewPaperPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <DOISearch />
        </div>
        <div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">手动添加论文</h3>
            <p className="text-sm text-gray-600 mb-4">
              如果论文没有DOI或无法通过DOI找到，您可以手动填写论文信息
            </p>
            <AddPaperForm />
          </div>
        </div>
      </div>
    </div>
  )
}

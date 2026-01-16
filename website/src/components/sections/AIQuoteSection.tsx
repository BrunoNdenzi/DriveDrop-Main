import NaturalLanguageShipmentCreator from '@/components/ai/NaturalLanguageShipmentCreator'

export default function AIQuoteSection() {
  return (
    <section id="ai-quote" className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-300 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-teal-300 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <NaturalLanguageShipmentCreator variant="hero" />

        {/* Features highlight below */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="text-center p-4">
            <div className="text-4xl mb-2">⚡</div>
            <h4 className="font-semibold text-gray-900 mb-1">30 Second Quotes</h4>
            <p className="text-sm text-gray-600">Skip the long forms, just tell us what you need</p>
          </div>
          <div className="text-center p-4">
            <div className="text-4xl mb-2">🤖</div>
            <h4 className="font-semibold text-gray-900 mb-1">AI-Powered</h4>
            <p className="text-sm text-gray-600">Smart technology understands your needs instantly</p>
          </div>
          <div className="text-center p-4">
            <div className="text-4xl mb-2">✨</div>
            <h4 className="font-semibold text-gray-900 mb-1">Auto-Fill Forms</h4>
            <p className="text-sm text-gray-600">No more typing, we handle the details</p>
          </div>
        </div>
      </div>
    </section>
  )
}

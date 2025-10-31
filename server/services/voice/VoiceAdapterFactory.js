const OpenAIVoiceAdapter = require('./OpenAIVoiceAdapter');
const MockVoiceAdapter = require('./MockVoiceAdapter');

class VoiceAdapterFactory {
  static createAdapter(adapterType = null) {
    const type = adapterType || process.env.VOICE_ADAPTER || 'mock';

    switch (type.toLowerCase()) {
      case 'openai':
        try {
          return new OpenAIVoiceAdapter();
        } catch (error) {
          console.warn('Failed to initialize OpenAI adapter, falling back to Mock:', error.message);
          return new MockVoiceAdapter();
        }
      
      case 'mock':
      default:
        return new MockVoiceAdapter();
    }
  }

  static getAvailableAdapters() {
    const adapters = ['mock'];
    
    if (process.env.OPENAI_API_KEY) {
      adapters.push('openai');
    }
    
    return adapters;
  }
}

module.exports = VoiceAdapterFactory;


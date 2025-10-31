import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './VoiceAssistant.css';

const VoiceAssistant = ({ onEventAdded, userInfo, existingEvents }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('idle'); // idle, listening, processing, speaking
  const [conflictData, setConflictData] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [pendingEvent, setPendingEvent] = useState(null);

  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setTranscript('');
    };

    recognition.onresult = (event) => {
      const transcriptText = event.results[0][0].transcript;
      setTranscript(transcriptText);
      handleVoiceInput(transcriptText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setStatus('idle');
      if (event.error === 'no-speech') {
        speak('I didn\'t catch that. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (status === 'listening') {
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Initialize Speech Synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text) => {
    if (!synthesisRef.current) return;

    // Cancel any ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setStatus('speaking');
    };

    utterance.onend = () => {
      setStatus('idle');
    };

    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setStatus('idle');
    };

    synthesisRef.current.speak(utterance);
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setResponse('');
      setConflictData(null);
      setAlternatives([]);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatus('idle');
    }
  };

  const handleVoiceInput = async (transcriptText) => {
    setStatus('processing');
    setTranscript(transcriptText);

    try {
      // Parse intent and extract event details
      const intentResponse = await axios.post('/api/voice/process', {
        transcript: transcriptText,
        context: {
          currentDate: new Date().toISOString().split('T')[0]
        }
      });

      if (!intentResponse.data.success) {
        throw new Error(intentResponse.data.error || 'Failed to process voice input');
      }

      const { intent, eventDetails } = intentResponse.data;

      if (intent === 'add_event') {
        await handleAddEvent(eventDetails);
      } else {
        const responseText = await generateResponse({
          type: 'info',
          message: `I understand you want to ${intent.replace('_', ' ')}, but I can currently only help with adding events.`
        });
        setResponse(responseText);
        speak(responseText);
      }
    } catch (error) {
      console.error('Error handling voice input:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      setResponse(errorMessage);
      speak(errorMessage);
      setStatus('idle');
    }
  };

  const handleAddEvent = async (eventDetails) => {
    // Store pending event
    setPendingEvent(eventDetails);

    try {
      // Check for conflicts
      const conflictResponse = await axios.post('/api/voice/check-conflict', {
        eventDetails,
        existingEvents: existingEvents || [],
        tokens: userInfo?.tokens || null
      });

      if (!conflictResponse.data.success) {
        throw new Error(conflictResponse.data.error || 'Failed to check conflicts');
      }

      const { hasConflict, conflictInfo, alternatives: altTimes, response: conflictResponseText, allowOverride } = conflictResponse.data;

      if (hasConflict) {
        // Store conflict data for user decision
        setConflictData({
          conflictInfo,
          allowOverride
        });
        setAlternatives(altTimes || []);
        setResponse(conflictResponseText);
        speak(conflictResponseText);
      } else {
        // No conflict, create event directly
        await createEvent(eventDetails, false);
      }
    } catch (error) {
      console.error('Error checking conflict:', error);
      const errorMessage = 'Sorry, I couldn\'t check for conflicts. Please try again.';
      setResponse(errorMessage);
      speak(errorMessage);
      setStatus('idle');
    }
  };

  const handleUserChoice = async (choice) => {
    if (!pendingEvent) return;

    if (choice.type === 'alternative') {
      // User chose an alternative time
      const updatedEvent = {
        ...pendingEvent,
        date: choice.date,
        time: choice.time
      };
      await createEvent(updatedEvent, false);
    } else if (choice.type === 'override') {
      // User chose to double book
      await createEvent(pendingEvent, true);
    } else if (choice.type === 'cancel') {
      // User cancelled
      setPendingEvent(null);
      setConflictData(null);
      setAlternatives([]);
      setResponse('');
      const cancelMessage = 'Okay, I\'ve cancelled that. What else can I help you with?';
      speak(cancelMessage);
      setResponse(cancelMessage);
    }
  };

  const createEvent = async (eventDetails, override) => {
    try {
      const createResponse = await axios.post('/api/voice/create-event', {
        eventDetails,
        tokens: userInfo?.tokens || null,
        override
      });

      if (!createResponse.data.success) {
        throw new Error(createResponse.data.error || 'Failed to create event');
      }

      const { event, response: successResponse } = createResponse.data;
      
      // Clear pending state
      setPendingEvent(null);
      setConflictData(null);
      setAlternatives([]);
      
      // Notify parent component
      if (onEventAdded) {
        onEventAdded(event);
      }

      // Speak success message
      setResponse(successResponse);
      speak(successResponse);
      setStatus('idle');
    } catch (error) {
      console.error('Error creating event:', error);
      const errorMessage = 'Sorry, I couldn\'t create that event. Please try again.';
      setResponse(errorMessage);
      speak(errorMessage);
      setStatus('idle');
    }
  };

  const generateResponse = async (responseData) => {
    try {
      const response = await axios.post('/api/voice/generate-response', {
        responseData
      });
      return response.data.response;
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Got it!';
    }
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="voice-assistant">
      <div className="voice-assistant-header">
        <h3>🎤 Voice Assistant</h3>
        <div className="voice-status">
          <span className={`status-indicator ${status}`}></span>
          <span className="status-text">
            {status === 'idle' && 'Ready'}
            {status === 'listening' && 'Listening...'}
            {status === 'processing' && 'Processing...'}
            {status === 'speaking' && 'Speaking...'}
          </span>
        </div>
      </div>

      <div className="voice-controls">
        <button
          className={`voice-button ${isListening ? 'listening' : ''}`}
          onClick={isListening ? stopListening : startListening}
          disabled={status === 'processing' || status === 'speaking'}
        >
          {isListening ? '🛑 Stop' : '🎤 Start Speaking'}
        </button>
      </div>

      {transcript && (
        <div className="voice-transcript">
          <strong>You said:</strong>
          <p>{transcript}</p>
        </div>
      )}

      {response && (
        <div className="voice-response">
          <strong>Assistant:</strong>
          <p>{response}</p>
        </div>
      )}

      {conflictData && alternatives.length > 0 && (
        <div className="conflict-options">
          <h4>Choose an option:</h4>
          
          <div className="alternatives-list">
            {alternatives.map((alt, index) => (
              <button
                key={index}
                className="alternative-btn"
                onClick={() => handleUserChoice({
                  type: 'alternative',
                  date: alt.date,
                  time: alt.time
                })}
              >
                <span className="alternative-time">{formatTime(alt.time)}</span>
                <span className="alternative-date">{formatDate(alt.date)}</span>
              </button>
            ))}
          </div>

          {conflictData.allowOverride && (
            <button
              className="override-btn"
              onClick={() => handleUserChoice({ type: 'override' })}
            >
              📅 Double Book (Override Conflict)
            </button>
          )}

          <button
            className="cancel-btn"
            onClick={() => handleUserChoice({ type: 'cancel' })}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;


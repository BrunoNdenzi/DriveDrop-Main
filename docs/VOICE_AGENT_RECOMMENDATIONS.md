# Voice Agent Recommendations

## Goals
- Improve the naturalness of the Vapi voice agent interactions.
- Streamline the carrier acquisition flow for better user experience.

## Personas
- **End Users**: Individuals seeking information or support through the voice agent.
- **Carriers**: Representatives of service providers engaged in the recruitment process.
- **Moderators**: Personnel managing the interaction flow and tuning the voice agent's responses.

## Carrier Recruitment Conversation Rules
1. Establish rapport before asking for information.
2. Use open-ended questions to encourage dialogue.
3. Ensure clarity in questions to avoid confusion.

## Turn-Taking/Barge-In Rules
- Allow users to interrupt the agent at any point.
- Clearly indicate when the agent is done speaking to invite responses.

## Tool Usage Rules
- Leverage tools like speech recognition and user intent analysis effectively to guide the conversation.
- Ensure fallback mechanisms are in place if the tool fails to understand the user.

## Webhook Security & Idempotency Recommendations
- Implement strict authentication and authorization measures for webhook calls.
- Ensure that all webhook calls are idempotent to prevent duplicate actions.

## Logging/Analytics Schema Fields
- **userID**: Unique identifier for the user.
- **sessionID**: Identifier for the conversation session.
- **timestamp**: Date and time of the interaction.
- **intent**: The identified intent from the user input.
- **responseTime**: Time taken to generate a response.

## Tuning Parameters
- **temperature**: Control the randomness of responses.
- **responseDelaySeconds**: Adjust the delay before the assistant responds.
- **numWordsToInterruptAssistant**: Number of words the user can speak before the agent is interrupted.

## Do/Don't Phrasing Examples
- **Do**: "Can you help me with..."
- **Don't**: "I need..."
- **Do**: "What are my options for..."
- **Don't**: "Tell me..."

## Objection Handling Mini-Library
- **Objection**: 
  - "I don’t have time to talk right now."
  - **Response**: "I understand. Can I assist you quickly with a question?"

- **Objection**: 
  - "I’m not interested."
  - **Response**: "I appreciate your honesty. Could you tell me what might interest you?"

## Iteration Process Using Voice Call Logs
1. Analyze voice call logs regularly to identify trends and common issues.
2. Solicit feedback from users and carriers to improve responses.
3. Implement changes and track the effectiveness in subsequent calls.
# Free browser voice trial

Open https://tanapat1604-cmd.github.io/CIC-bot/#/talk in a supported browser. Check the browser speech consent box, press เริ่มฟัง and allow microphone access. Say สิบสองบวกแปดเท่าไหร่. The page displays the transcript, computes 20 using exact rational arithmetic, then asks browser speech synthesis to read the answer. Editing the transcript and typed calculation work without microphone access. Optional repeat listening starts only after speech synthesis finishes. Stop and page exit cancel the owned recognition and speech. Permission/network failures require a user retry.

The browser may send audio and reply text to its speech services. The page does not save raw audio or call a CiC backend, OpenAI API or paid model. Service/language availability is browser-dependent. TTS uses an installed matching local voice first when available. No promise is made that browser speech works offline or is universally supported.

YouTube requests prepare a fixed reviewed link requiring a click. Public hosting cannot control installed apps. The page supports bounded arithmetic, time, greetings and YouTube links, not general assistant intelligence. Word operands cover the existing Thai/English 0..999 grammar; literal numeric expressions support brackets, decimal inputs and ordinary operator precedence. Unknown/negated/quoted/compound requests produce clarification rather than guessed actions.

Validation: six arithmetic/capture lifecycle unit cases and five simulated browser-flow cases passed locally. These are tests of code and injected browser events; they do not measure real microphone recognition accuracy, real loudspeaker audio or human speech-end latency. The user will perform the real microphone trial after deployment.

Official browser documentation: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition and https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API

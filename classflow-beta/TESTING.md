# ClassFlow 2.0 Beta — Internal Test Checklist

## Scope
This beta is isolated at `/classflow-beta/` and does not replace the stable `/classflow/` app.

## Core experiments
- OpenAI Realtime transcription (`gpt-live-transcribe`) over WebRTC
- Semantic VAD / Server VAD switching
- Browser Web Speech automatic fallback
- Translation starts immediately after final transcript (cloud save runs in parallel)
- 30-second audio chunk recording with IndexedDB-first persistence
- Automatic retry of pending recording uploads
- Private Supabase Storage bucket and per-user RLS
- Translation latency metrics

## Test scenarios
1. Start with Pipeline = Auto, VAD = Semantic.
2. Speak for 5–10 minutes with normal classroom pauses.
3. Verify partial transcript appears before final segments.
4. Verify translation latency metric updates.
5. Pause and confirm the final audio chunk uploads.
6. Click an uploaded audio chunk and verify playback.
7. Disable network briefly, keep recording, reconnect, then press Retry Upload.
8. Switch to Browser pipeline and compare segmentation.
9. Switch between English and Russian.
10. Generate class notes and confirm notes appear below the notes button, never inside Full Translation.

## Expected fallback behavior
If Realtime session creation or WebRTC fails in Auto mode, ClassFlow automatically switches to Browser speech recognition while audio recording continues.

## Known beta limitation
Realtime transcription requires OpenAI API access for `gpt-live-transcribe`. If the API project is not eligible for that model, Auto mode should fall back to Browser recognition.

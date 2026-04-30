"use client";

import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, TextField, Alert, CircularProgress,
  CssBaseline, IconButton, Chip, Divider, Tooltip,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ArrowLeft, Zap, RefreshCw, Check, X, Lock, Mic } from 'react-feather';
import { useRouter, useParams } from 'next/navigation';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0f0f10', paper: '#1c1c1d' },
    primary: { main: '#ffffff', light: 'rgba(255,255,255,0.8)', dark: 'rgba(255,255,255,0.9)', contrastText: '#111111' },
    secondary: { main: '#8b5cf6' },
  },
  shape: { borderRadius: 16 },
  typography: { fontFamily: 'inherit', button: { textTransform: 'none', fontWeight: 600 } },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { lineHeight: 1, paddingTop: 8, paddingBottom: 9, borderRadius: '10px' },
        sizeSmall: { paddingTop: 5, paddingBottom: 5 },
      }
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: '10px' } } },
  }
});

interface VoiceSample {
  text: string;
  decision: 'yes' | 'no' | null;
  reasoning: string;
}

interface VoiceRound {
  round: number;
  samples: VoiceSample[];
}

const VOICE_PROMPTS = [
  '"You\'re a young person talking casually to a close friend — no fluff, straight to the point…"',
  '"You\'re a witty older sibling who roasts gently and makes people feel seen…"',
  '"You\'re a brand that never tries too hard. Every line earns its place…"',
  '"You\'re a confident expert who shares knowledge without being preachy…"',
  '"You\'re a storyteller who turns everyday moments into something worth reading…"',
];

export default function VoiceBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const brandId = params.brand_id as string;

  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Voice state
  const [description, setDescription] = useState('');
  const [rounds, setRounds] = useState<VoiceRound[]>([]);
  const [currentSamples, setCurrentSamples] = useState<VoiceSample[]>([]);
  const [currentRoundNum, setCurrentRoundNum] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBrief, setLockedBrief] = useState('');
  const [lockedExamples, setLockedExamples] = useState<string[]>([]);

  // Loading states
  const [generating, setGenerating] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    fetch('/api/brands')
      .then(r => r.json())
      .then(d => {
        const b = (d.brands || []).find((x: any) => x.brand_id === brandId);
        if (!b) { setError('Brand not found'); return; }
        setBrand(b);
        setDescription(b.brand_identity_doc || '');
        const vp = b.voice_profile || {};
        setIsLocked(vp.locked === true);
        setLockedBrief(b.brand_identity_doc || '');
        setLockedExamples(vp.locked_examples || []);
        if (vp.rounds?.length > 0) {
          setRounds(vp.rounds);
          setCurrentRoundNum(vp.rounds.length);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [brandId]);

  const handleGenerate = async () => {
    if (!description.trim()) { setError('Write a voice description first'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/brands/${brandId}/voice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brand?.brand_name,
          description,
          tone: brand?.creative_variables?.tone,
          creativity: brand?.creative_variables?.creativity,
          trend_weight: brand?.creative_variables?.trend_weight,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setCurrentSamples(data.samples.map((text: string) => ({ text, decision: null, reasoning: '' })));
      setCurrentRoundNum(rounds.length + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDecision = (idx: number, decision: 'yes' | 'no') => {
    setCurrentSamples(prev => prev.map((s, i) =>
      i === idx ? { ...s, decision: s.decision === decision ? null : decision } : s
    ));
  };

  const handleReasoning = (idx: number, reasoning: string) => {
    setCurrentSamples(prev => prev.map((s, i) => i === idx ? { ...s, reasoning } : s));
  };

  const canSubmit = currentSamples.length > 0 &&
    currentSamples.every(s => s.decision !== null) &&
    currentSamples.filter(s => s.decision === 'no').every(s => s.reasoning.trim().length > 0);

  const handleTune = async () => {
    if (!canSubmit) return;
    setTuning(true);
    setError('');
    try {
      const newRound: VoiceRound = { round: currentRoundNum, samples: currentSamples };
      const updatedRounds = [...rounds, newRound];

      const res = await fetch(`/api/brands/${brandId}/voice/tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brand?.brand_name,
          description,
          tone: brand?.creative_variables?.tone,
          creativity: brand?.creative_variables?.creativity,
          trend_weight: brand?.creative_variables?.trend_weight,
          rounds: updatedRounds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tuning failed');

      setRounds(updatedRounds);
      setCurrentSamples(data.samples.map((text: string) => ({ text, decision: null, reasoning: '' })));
      setCurrentRoundNum(updatedRounds.length + 1);
      setStatusMsg(`Round ${currentRoundNum} saved. New samples generated.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTuning(false);
    }
  };

  const handleLock = async () => {
    setLocking(true);
    setError('');
    try {
      const finalRounds = currentSamples.length > 0 && currentSamples.some(s => s.decision !== null)
        ? [...rounds, { round: currentRoundNum, samples: currentSamples }]
        : rounds;

      const res = await fetch(`/api/brands/${brandId}/voice/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: brand?.brand_name, description, rounds: finalRounds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lock failed');
      setIsLocked(true);
      setLockedBrief(data.voice_brief);
      const allYes = finalRounds.flatMap(r => r.samples.filter(s => s.decision === 'yes').map(s => s.text));
      setLockedExamples(allYes);
      setStatusMsg('Voice locked! Brief is now injected into all concept generations.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, voice_profile: { locked: false, rounds, locked_examples: lockedExamples } }),
      });
      setIsLocked(false);
      setStatusMsg('Voice unlocked. Continue tuning or lock again when ready.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
          <CssBaseline /><CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 10 }}>
        <CssBaseline />

        {/* Header */}
        <Box sx={{ borderBottom: '1px solid #363639', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2, position: 'sticky', top: 0, zIndex: 10, bgcolor: '#0f0f10' }}>
          <IconButton onClick={() => router.push(`/variables?brand=${brandId}`)} sx={{ color: 'white' }}>
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Zap size={18} /> JamBox
          </Typography>
          <Typography variant="body2" color="text.secondary">/ Variables / Voice Builder</Typography>
          <Chip label={brand?.brand_name} size="small" variant="outlined" sx={{ ml: 1, borderColor: '#363639' }} />
          {isLocked && (
            <Chip
              icon={<Lock size={12} />}
              label="Voice Locked"
              size="small"
              sx={{ bgcolor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', '& .MuiChip-icon': { color: '#22c55e' } }}
            />
          )}
          <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
            {isLocked ? (
              <Button variant="outlined" size="small" onClick={handleUnlock}
                sx={{ borderRadius: '10px', borderColor: '#363639', color: 'rgba(255,255,255,0.6)' }}>
                Unlock & Edit
              </Button>
            ) : rounds.length > 0 || currentSamples.length > 0 ? (
              <Button
                variant="contained"
                onClick={handleLock}
                disabled={locking}
                startIcon={locking ? <CircularProgress size={14} color="inherit" /> : <Lock size={14} />}
                sx={{ borderRadius: '10px', paddingTop: '11px', paddingBottom: '12px', bgcolor: '#22c55e', color: '#000', '&:hover': { bgcolor: '#16a34a' } }}
              >
                Lock Voice
              </Button>
            ) : null}
          </Box>
        </Box>

        <Container maxWidth="md" sx={{ pt: 4 }}>

          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
          {statusMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setStatusMsg('')}>{statusMsg}</Alert>}

          {/* Locked state banner */}
          {isLocked && (
            <Box sx={{ p: 3, bgcolor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', mb: 4 }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#22c55e', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lock size={14} /> Voice brief (injected into every generation)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', lineHeight: 1.7 }}>
                {lockedBrief}
              </Typography>
              {lockedExamples.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Approved examples
                  </Typography>
                  {lockedExamples.map((ex, i) => (
                    <Typography key={i} variant="body2" color="text.secondary" sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '10px', mb: 0.75, fontStyle: 'italic' }}>
                      "{ex}"
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Round history */}
          {rounds.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, fontSize: '0.7rem' }}>
                Round History
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {rounds.map((r) => {
                  const yes = r.samples.filter(s => s.decision === 'yes').length;
                  const total = r.samples.length;
                  return (
                    <Chip
                      key={r.round}
                      label={`Round ${r.round} — ${yes}/${total} YES`}
                      size="small"
                      sx={{
                        bgcolor: yes === total ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${yes === total ? 'rgba(34,197,94,0.3)' : '#363639'}`,
                        color: yes === total ? '#22c55e' : 'text.secondary',
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Step 1: Voice Description */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Mic size={16} />
              <Typography variant="h6" fontWeight="bold">Voice Description</Typography>
              {rounds.length === 0 && currentSamples.length === 0 && (
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Step 1 of 3</Typography>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Describe how this brand talks. Be as specific as possible — reference tone, energy, cultural references, what it avoids. The more detail, the better the samples.
            </Typography>

            {/* Inspiration prompts */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {VOICE_PROMPTS.map((p, i) => (
                <Chip key={i} label={`Try: ${p.slice(0, 40)}…`} size="small" variant="outlined"
                  sx={{ cursor: 'pointer', borderColor: '#363639', color: 'text.disabled', fontSize: '0.72rem', '&:hover': { borderColor: 'rgba(255,255,255,0.4)', color: 'white' } }}
                  onClick={() => setDescription(p.replace(/^"|"$/g, ''))}
                />
              ))}
            </Box>

            <TextField
              multiline
              minRows={4}
              fullWidth
              placeholder='e.g. "You\'re a young person speaking casually to a peer. You don\'t over-explain. You use humor but never try too hard. You sound like a real person, not a brand."'
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isLocked}
            />
          </Box>

          {/* Generate / Regenerate button */}
          {!isLocked && (
            <Box sx={{ mb: 4 }}>
              <Button
                variant={currentSamples.length === 0 ? 'contained' : 'outlined'}
                onClick={handleGenerate}
                disabled={generating || !description.trim()}
                startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />}
                sx={{
                  borderRadius: '10px', paddingTop: '11px', paddingBottom: '12px',
                  ...(currentSamples.length === 0 ? {} : { borderColor: '#363639', color: 'white' }),
                }}
              >
                {generating ? 'Generating…' : currentSamples.length === 0 ? 'Generate Examples' : 'Regenerate from scratch'}
              </Button>
              {currentSamples.length === 0 && (
                <Typography variant="caption" color="text.disabled" sx={{ ml: 2 }}>
                  Takes ~10 seconds
                </Typography>
              )}
            </Box>
          )}

          {/* Step 2: Sample cards */}
          {currentSamples.length > 0 && !isLocked && (
            <>
              <Divider sx={{ borderColor: '#363639', mb: 3 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Round {currentRoundNum} — Sample Captions</Typography>
                <Typography variant="caption" color="text.disabled">
                  Mark each YES or NO, explain the NOs, then submit
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                {currentSamples.map((sample, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 2.5, borderRadius: '16px', border: '1px solid',
                      borderColor: sample.decision === 'yes' ? 'rgba(34,197,94,0.4)' : sample.decision === 'no' ? 'rgba(239,68,68,0.4)' : '#363639',
                      bgcolor: sample.decision === 'yes' ? 'rgba(34,197,94,0.05)' : sample.decision === 'no' ? 'rgba(239,68,68,0.05)' : '#1c1c1d',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.7, flex: 1, fontStyle: 'italic' }}>
                      "{sample.text}"
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        onClick={() => handleDecision(idx, 'yes')}
                        sx={{
                          flex: 1, boxShadow: 'none',
                          backgroundColor: sample.decision === 'yes' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                          color: sample.decision === 'yes' ? '#22c55e' : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${sample.decision === 'yes' ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
                          '&:hover': { backgroundColor: 'rgba(34,197,94,0.15)' },
                        }}
                      >
                        <Check size={13} style={{ marginRight: 4 }} /> YES
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        onClick={() => handleDecision(idx, 'no')}
                        sx={{
                          flex: 1, boxShadow: 'none',
                          backgroundColor: sample.decision === 'no' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                          color: sample.decision === 'no' ? '#ef4444' : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${sample.decision === 'no' ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                          '&:hover': { backgroundColor: 'rgba(239,68,68,0.15)' },
                        }}
                      >
                        <X size={13} style={{ marginRight: 4 }} /> NO
                      </Button>
                    </Box>

                    {sample.decision === 'no' && (
                      <TextField
                        size="small"
                        placeholder="Why? (required — e.g. too formal, wrong era, off-brand slang)"
                        value={sample.reasoning}
                        onChange={e => handleReasoning(idx, e.target.value)}
                        error={sample.decision === 'no' && !sample.reasoning.trim()}
                        helperText={sample.decision === 'no' && !sample.reasoning.trim() ? 'Explain what\'s off so the AI can correct it' : ''}
                        multiline
                        minRows={2}
                      />
                    )}
                  </Box>
                ))}
              </Box>

              {/* Step 3: Submit */}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Tooltip title={!canSubmit ? 'Decide YES/NO on all samples and explain any NOs' : ''}>
                  <span>
                    <Button
                      variant="contained"
                      onClick={handleTune}
                      disabled={!canSubmit || tuning}
                      startIcon={tuning ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />}
                      sx={{ borderRadius: '10px', paddingTop: '11px', paddingBottom: '12px' }}
                    >
                      {tuning ? 'Generating next round…' : 'Submit Feedback & Regenerate'}
                    </Button>
                  </span>
                </Tooltip>

                {canSubmit && (
                  <Typography variant="caption" color="text.disabled">
                    {currentSamples.filter(s => s.decision === 'yes').length}/{currentSamples.length} YES — or lock if this feels right
                  </Typography>
                )}
              </Box>
            </>
          )}

          {/* Empty state */}
          {currentSamples.length === 0 && rounds.length === 0 && !isLocked && (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <Mic size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
              <Typography variant="body2">Describe the voice above, then hit Generate Examples to start.</Typography>
            </Box>
          )}

        </Container>
      </Box>
    </ThemeProvider>
  );
}

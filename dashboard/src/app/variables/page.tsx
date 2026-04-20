"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Button, TextField, Chip, Slider, Alert, CircularProgress,
  Divider, IconButton, CssBaseline, Card, CardContent, RadioGroup, Radio,
  FormControlLabel, FormLabel, Accordion, AccordionSummary, AccordionDetails, Tooltip
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faWandMagicSparkles, faPlus, faXmark, faRotate,
  faCalendarDays, faChartLine, faSliders, faLocationDot, faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0A0A0A', paper: '#141414' },
    primary: { main: '#3B82F6' },
    secondary: { main: '#8b5cf6' },
  },
  shape: { borderRadius: 16 },
  typography: { fontFamily: 'inherit', button: { textTransform: 'none', fontWeight: 600 } },
  components: {
    MuiCard: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.05)' } } },
    MuiAccordion: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.05)', '&:before': { display: 'none' } } } },
  }
});

const TONE_OPTIONS = ['playful', 'witty', 'bold', 'authentic', 'premium', 'rebellious'];

function VariablesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeBrandId, setActiveBrandId] = useState(searchParams.get('brand') || 'fuzzys_taco_shop');
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Core variables
  const [tone, setTone] = useState('witty');
  const [creativity, setCreativity] = useState(0.8);
  const [trendWeight, setTrendWeight] = useState(0.6);

  // Topic lists
  const [pushTopics, setPushTopics] = useState<string[]>([]);
  const [avoidTopics, setAvoidTopics] = useState<string[]>([]);
  const [pushInput, setPushInput] = useState('');
  const [avoidInput, setAvoidInput] = useState('');

  // New variables
  const [visualStyle, setVisualStyle] = useState('');
  const [publicTopics, setPublicTopics] = useState<string[]>([]);
  const [publicTopicInput, setPublicTopicInput] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');

  // Temporal context
  const [temporalContext, setTemporalContext] = useState<any[]>([]);
  const [customTemporalInput, setCustomTemporalInput] = useState('');

  // Trend signals
  const [trendSignals, setTrendSignals] = useState<any[]>([]);
  const [customSignalInput, setCustomSignalInput] = useState('');

  // Load brand data
  const loadBrand = useCallback(async (brandId: string) => {
    setLoading(true);
    try {
      const [brandsRes, ctxRes] = await Promise.all([
        fetch('/api/brands').then(r => r.json()),
        fetch(`/api/variables/context?brand_id=${brandId}`).then(r => r.json()),
      ]);

      if (brandsRes.brands) {
        setBrands(brandsRes.brands);
        const brand = brandsRes.brands.find((b: any) => b.brand_id === brandId);
        if (brand?.creative_variables) {
          const v = brand.creative_variables;
          setTone(v.tone || 'witty');
          setCreativity(v.creativity ?? 0.8);
          setTrendWeight(v.trend_weight ?? 0.6);
          setPushTopics(v.push_topics || []);
          setAvoidTopics(v.avoid_topics || []);
          setVisualStyle(v.visual_style || '');
          setPublicTopics(v.public_topic_alignment || []);
          setLocations(v.locations || []);
        }
      }

      if (!ctxRes.error) {
        setTemporalContext(ctxRes.temporal_context || []);
        setTrendSignals(ctxRes.trend_signals || []);
      }
    } catch (e) {
      console.error('Failed to load brand:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrand(activeBrandId);
  }, [activeBrandId, loadBrand]);

  const handleSave = async (runNow = false) => {
    setSaving(true);
    setStatusMsg('Saving...');
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: activeBrandId,
          creative_variables: {
            tone,
            creativity,
            trend_weight: trendWeight,
            push_topics: pushTopics,
            avoid_topics: avoidTopics,
            visual_style: visualStyle,
            public_topic_alignment: publicTopics,
            locations,
            temporal_context: temporalContext,
            trend_signals: trendSignals,
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setStatusMsg('✅ Variables saved!');

      if (runNow) {
        setSaving(false);
        setGenerating(true);
        setStatusMsg('🚀 Generating concepts… (~30s)');
        const genRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_id: activeBrandId }),
        });
        const genData = await genRes.json();
        setGenerating(false);
        if (!genRes.ok) throw new Error(genData.error || 'Generation failed');
        setStatusMsg(`✅ Done! ${(genData.results || []).join(' · ')}`);
      }
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const regenerateContext = async () => {
    setContextLoading(true);
    setStatusMsg('Generating temporal context & trend signals...');
    try {
      const brand = brands.find(b => b.brand_id === activeBrandId);
      const res = await fetch('/api/variables/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: activeBrandId,
          brand_name: brand?.brand_name || activeBrandId,
          industry: brand?.config?.industry || 'general',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setTemporalContext(data.temporal_context || []);
      setTrendSignals(data.trend_signals || []);
      setStatusMsg('✅ Context regenerated!');
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
    } finally {
      setContextLoading(false);
    }
  };

  const addChip = (list: string[], setList: (v: string[]) => void, val: string, setVal: (v: string) => void) => {
    if (!val.trim() || list.includes(val.trim())) return;
    setList([...list, val.trim()]);
    setVal('');
  };

  const addCustomTemporal = () => {
    if (!customTemporalInput.trim()) return;
    setTemporalContext([...temporalContext, { label: customTemporalInput.trim(), type: 'custom', custom: true }]);
    setCustomTemporalInput('');
  };

  const addCustomSignal = () => {
    if (!customSignalInput.trim()) return;
    setTrendSignals([...trendSignals, { signal: customSignalInput.trim(), source: 'custom', strength: 'medium', custom: true }]);
    setCustomSignalInput('');
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

  const signalColor: Record<string, string> = { high: '#22c55e', medium: '#f59e0b', low: '#94a3b8' };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 10 }}>
        <CssBaseline />

        {/* Header */}
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2, position: 'sticky', top: 0, zIndex: 10, bgcolor: '#0A0A0A' }}>
          <IconButton onClick={() => router.push('/')} sx={{ color: 'white' }}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#3B82F6' }} /> JamBox
          </Typography>
          <Typography variant="body2" color="text.secondary">/ Variables</Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => handleSave(true)}
              disabled={saving || generating || contextLoading}
              sx={{ borderRadius: 20 }}
            >
              {generating ? '🚀 Generating…' : 'Save & Generate Now'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSave(false)}
              disabled={saving || generating}
              sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Save
            </Button>
          </Box>
        </Box>

        <Container maxWidth="md" sx={{ pt: 4 }}>

          {/* Brand selector */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 4, flexWrap: 'wrap' }}>
            {brands.map(b => (
              <Chip
                key={b.brand_id}
                label={b.brand_name}
                onClick={() => setActiveBrandId(b.brand_id)}
                color={b.brand_id === activeBrandId ? 'primary' : 'default'}
                variant={b.brand_id === activeBrandId ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>

          {statusMsg && (
            <Alert severity={statusMsg.startsWith('❌') ? 'error' : statusMsg.startsWith('✅') ? 'success' : 'info'} sx={{ mb: 3 }} onClose={() => setStatusMsg('')}>
              {statusMsg}
            </Alert>
          )}

          {/* Section: Creative Foundation */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.8em' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FontAwesomeIcon icon={faSliders} style={{ color: '#3B82F6' }} />
                <Typography fontWeight="bold">Creative Foundation</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                {/* Tone */}
                <Box>
                  <FormLabel sx={{ mb: 1, display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Tone</FormLabel>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {TONE_OPTIONS.map(t => (
                      <Chip key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} onClick={() => setTone(t)}
                        color={tone === t ? 'primary' : 'default'}
                        variant={tone === t ? 'filled' : 'outlined'}
                        sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Visual Style */}
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Visual Style</Typography>
                  <TextField
                    fullWidth size="small"
                    placeholder="e.g. warm, overhead, real food photography"
                    value={visualStyle}
                    onChange={e => setVisualStyle(e.target.value)}
                  />
                </Box>

                {/* Creativity */}
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Creativity — {creativity <= 0.3 ? 'Conservative' : creativity >= 0.8 ? 'Wild' : 'Balanced'} ({Math.round(creativity * 10)}/10)
                  </Typography>
                  <Slider value={creativity} onChange={(_, v) => setCreativity(v as number)} min={0.1} max={1.0} step={0.1} valueLabelDisplay="auto" valueLabelFormat={v => Math.round(v * 10)} />
                </Box>

                {/* Trend Weight */}
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Trend Weight — {trendWeight <= 0.3 ? 'Evergreen' : trendWeight >= 0.8 ? 'Trendy' : 'Mixed'} ({Math.round(trendWeight * 10)}/10)
                  </Typography>
                  <Slider value={trendWeight} onChange={(_, v) => setTrendWeight(v as number)} min={0.1} max={1.0} step={0.1} valueLabelDisplay="auto" valueLabelFormat={v => Math.round(v * 10)} />
                </Box>

                {/* Push topics */}
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Topics to Push</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {pushTopics.map(t => (
                      <Chip key={t} label={t} onDelete={() => setPushTopics(pushTopics.filter(x => x !== t))} size="small" />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="Add topic" value={pushInput} onChange={e => setPushInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addChip(pushTopics, setPushTopics, pushInput, setPushInput)}
                      sx={{ flexGrow: 1 }} />
                    <Button onClick={() => addChip(pushTopics, setPushTopics, pushInput, setPushInput)} variant="outlined" size="small" sx={{ borderRadius: 8 }}>
                      <FontAwesomeIcon icon={faPlus} />
                    </Button>
                  </Box>
                </Box>

                {/* Avoid topics */}
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Topics to Avoid</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {avoidTopics.map(t => (
                      <Chip key={t} label={t} onDelete={() => setAvoidTopics(avoidTopics.filter(x => x !== t))} size="small" color="error" variant="outlined" />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="Add topic to avoid" value={avoidInput} onChange={e => setAvoidInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addChip(avoidTopics, setAvoidTopics, avoidInput, setAvoidInput)}
                      sx={{ flexGrow: 1 }} />
                    <Button onClick={() => addChip(avoidTopics, setAvoidTopics, avoidInput, setAvoidInput)} variant="outlined" size="small" color="error" sx={{ borderRadius: 8 }}>
                      <FontAwesomeIcon icon={faPlus} />
                    </Button>
                  </Box>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Public Topic Alignment */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.8em' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FontAwesomeIcon icon={faChartLine} style={{ color: '#f59e0b' }} />
                <Typography fontWeight="bold">Public Topic Alignment</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Celebrities, sports, cultural moments</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current public subjects to tap into — celebrities, sports events, cultural conversations, viral moments.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {publicTopics.map(t => (
                  <Chip key={t} label={t} onDelete={() => setPublicTopics(publicTopics.filter(x => x !== t))} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }} />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" placeholder="e.g. Super Bowl LX, Coachella, Taylor Swift tour"
                  value={publicTopicInput} onChange={e => setPublicTopicInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip(publicTopics, setPublicTopics, publicTopicInput, setPublicTopicInput)}
                  sx={{ flexGrow: 1 }} />
                <Button onClick={() => addChip(publicTopics, setPublicTopics, publicTopicInput, setPublicTopicInput)} variant="outlined" size="small" sx={{ borderRadius: 8, borderColor: '#f59e0b', color: '#f59e0b' }}>
                  <FontAwesomeIcon icon={faPlus} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Locations */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.8em' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ color: '#22c55e' }} />
                <Typography fontWeight="bold">Locations / Key Markets</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Weather-aware, geo-relevant content</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Key markets for this brand. Used for weather-aware, geo-relevant content (e.g. Timberland boots when it's raining in the Northeast).
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {locations.map(l => (
                  <Chip key={l} label={l} onDelete={() => setLocations(locations.filter(x => x !== l))} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }} />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" placeholder="e.g. Dallas TX, Denver CO, Los Angeles CA"
                  value={locationInput} onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip(locations, setLocations, locationInput, setLocationInput)}
                  sx={{ flexGrow: 1 }} />
                <Button onClick={() => addChip(locations, setLocations, locationInput, setLocationInput)} variant="outlined" size="small" sx={{ borderRadius: 8, borderColor: '#22c55e', color: '#22c55e' }}>
                  <FontAwesomeIcon icon={faPlus} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Temporal / Calendar Context */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.8em' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                <FontAwesomeIcon icon={faCalendarDays} style={{ color: '#8b5cf6' }} />
                <Typography fontWeight="bold">Temporal / Calendar Context</Typography>
                <Chip label="Auto-generated" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontSize: '0.65rem', ml: 1 }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Upcoming Context — auto-generated weekly. Add your own custom entries below.
                </Typography>
                <Button
                  size="small"
                  startIcon={contextLoading ? <CircularProgress size={12} /> : <FontAwesomeIcon icon={faRotate} />}
                  onClick={regenerateContext}
                  disabled={contextLoading}
                  sx={{ borderRadius: 16, color: '#8b5cf6', borderColor: '#8b5cf6' }}
                  variant="outlined"
                >
                  {contextLoading ? 'Generating…' : 'Regenerate'}
                </Button>
              </Box>

              {temporalContext.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No calendar context yet. Click "Regenerate" to auto-generate upcoming events and observances.
                </Alert>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                  {temporalContext.map((entry: any, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, bgcolor: entry.custom ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 2, border: `1px solid ${entry.custom ? 'rgba(139,92,246,0.2)' : 'transparent'}` }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={entry.custom ? 600 : 400}>
                          {entry.label}
                          {entry.custom && <Chip label="custom" size="small" sx={{ ml: 1, fontSize: '0.6rem', bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }} />}
                        </Typography>
                        {entry.date && <Typography variant="caption" color="text.disabled">{entry.date}</Typography>}
                        {entry.relevance && <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>{entry.relevance}</Typography>}
                      </Box>
                      <IconButton size="small" onClick={() => setTemporalContext(temporalContext.filter((_, j) => j !== i))}>
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: '0.7em' }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" placeholder="Add custom context entry (e.g. Brand anniversary, Store opening)"
                  value={customTemporalInput} onChange={e => setCustomTemporalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomTemporal()}
                  sx={{ flexGrow: 1 }} />
                <Button onClick={addCustomTemporal} variant="outlined" size="small" sx={{ borderRadius: 8, borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                  <FontAwesomeIcon icon={faPlus} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Trend Signals */}
          <Accordion sx={{ mb: 4 }}>
            <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.8em' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                <FontAwesomeIcon icon={faChartLine} style={{ color: '#3B82F6' }} />
                <Typography fontWeight="bold">Trend Signals</Typography>
                <Chip label="Auto-generated weekly" size="small" sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: '0.65rem', ml: 1 }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current trends, platform algorithm changes, and cultural signals. Auto-generated based on today's date. Add your own below.
              </Typography>

              {trendSignals.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No trend signals yet. Click "Regenerate" in the Calendar Context section above to generate both.
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                  {trendSignals.map((signal: any, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: signal.custom ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 2, border: `1px solid ${signal.custom ? 'rgba(59,130,246,0.2)' : 'transparent'}` }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: signalColor[signal.strength] || '#94a3b8', flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{signal.signal}</Typography>
                        <Typography variant="caption" color="text.disabled">{signal.source}</Typography>
                      </Box>
                      <Chip
                        label={signal.strength}
                        size="small"
                        sx={{ fontSize: '0.65rem', bgcolor: `${signalColor[signal.strength]}22`, color: signalColor[signal.strength], border: `1px solid ${signalColor[signal.strength]}44` }}
                      />
                      <IconButton size="small" onClick={() => setTrendSignals(trendSignals.filter((_, j) => j !== i))}>
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: '0.7em' }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" placeholder="Add custom trend signal"
                  value={customSignalInput} onChange={e => setCustomSignalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomSignal()}
                  sx={{ flexGrow: 1 }} />
                <Button onClick={addCustomSignal} variant="outlined" size="small" sx={{ borderRadius: 8 }}>
                  <FontAwesomeIcon icon={faPlus} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Save actions at bottom */}
          <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Button
              variant="contained"
              onClick={() => handleSave(true)}
              disabled={saving || generating || contextLoading}
              sx={{ borderRadius: 20, flex: 1 }}
            >
              {generating ? '🚀 Generating…' : 'Save & Generate Now'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSave(false)}
              disabled={saving || generating}
              sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Save
            </Button>
            <Button onClick={() => router.push('/')} color="inherit" sx={{ borderRadius: 20 }}>
              Back
            </Button>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default function VariablesPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0A0A0A' }}>
        <CircularProgress />
      </Box>
    }>
      <VariablesPageInner />
    </Suspense>
  );
}

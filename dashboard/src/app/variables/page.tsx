"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Button, TextField, Chip, Slider, Alert, CircularProgress,
  IconButton, CssBaseline, FormLabel, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ArrowLeft, Zap, Plus, X, RefreshCw, Calendar, TrendingUp, Sliders, MapPin, ChevronDown, Coffee, Link, Globe, Edit2, Mic, Trash2 } from 'react-feather';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import BrandModal from '@/components/BrandModal';
import { DEFAULT_CATEGORIES } from '@/lib/categories';

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
    MuiCard: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #363639' } } },
    MuiAccordion: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: '#1c1c1d', border: '1px solid #363639', borderRadius: '16px !important', overflow: 'hidden', '&:before': { display: 'none' } } } },
    MuiChip: { styleOverrides: { root: { paddingBottom: '2px' } } },
    MuiButton: {
      styleOverrides: {
        root: { lineHeight: 1, paddingTop: 8, paddingBottom: 9, borderRadius: '10px' },
        sizeSmall: { paddingTop: 5, paddingBottom: 5 },
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontSize: '0.875rem',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 0 },
          '&.Mui-selected': { backgroundColor: 'rgba(255,255,255,0.08)' },
          '&.Mui-selected:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
        }
      }
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: '10px' } } },
    MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none' } } },
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

  // Brand modal state
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBrandId, setDeletingBrandId] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Custom categories
  const [customCategories, setCustomCategories] = useState<{ id: string; label: string }[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Temporal context
  const [temporalContext, setTemporalContext] = useState<any[]>([]);
  const [customTemporalInput, setCustomTemporalInput] = useState('');

  // Trend signals
  const [trendSignals, setTrendSignals] = useState<any[]>([]);
  const [customNationalInput, setCustomNationalInput] = useState('');
  const [customLocalInput, setCustomLocalInput] = useState('');
  const [sproutConnected, setSproutConnected] = useState<boolean | null>(null);

  // Menu items
  const [menuItems, setMenuItems] = useState<string[]>([]);
  const [menuItemInput, setMenuItemInput] = useState('');

  // Brand resource links
  const [cultureCalendarUrl, setCultureCalendarUrl] = useState('');
  const [pdpFolderUrl, setPdpFolderUrl] = useState('');

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
          setMenuItems(v.menu_items || []);
          setCustomCategories(v.custom_categories || []);
        }
        if (brand?.config) {
          setCultureCalendarUrl(brand.config.culture_calendar_url || '');
          setPdpFolderUrl(brand.config.pdp_folder_url || '');
        }
      }

      if (!ctxRes.error) {
        setTemporalContext(ctxRes.temporal_context || []);
        setTrendSignals(ctxRes.trend_signals || []);
        if (typeof ctxRes.sprout_connected === 'boolean') setSproutConnected(ctxRes.sprout_connected);
      }
    } catch (e) {
      console.error('Failed to load brand:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBrand(activeBrandId); }, [activeBrandId, loadBrand]);

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
            tone, creativity, trend_weight: trendWeight,
            push_topics: pushTopics, avoid_topics: avoidTopics,
            visual_style: visualStyle, public_topic_alignment: publicTopics,
            locations, temporal_context: temporalContext, trend_signals: trendSignals,
            menu_items: menuItems, custom_categories: customCategories,
          },
          config: { culture_calendar_url: cultureCalendarUrl, pdp_folder_url: pdpFolderUrl },
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
          locations,
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

  const addCustomSignal = (input: string, setInput: (v: string) => void, scope: 'national' | 'local') => {
    if (!input.trim()) return;
    setTrendSignals([...trendSignals, { signal: input.trim(), source: 'custom', strength: 'medium', scope, custom: true }]);
    setInput('');
  };

  const addCustomCategory = () => {
    if (!customCategoryInput.trim()) return;
    const id = customCategoryInput.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    if (customCategories.find(c => c.id === id)) return;
    setCustomCategories([...customCategories, { id, label: customCategoryInput.trim() }]);
    setCustomCategoryInput('');
  };

  const handleDeleteBrand = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/brands/${deletingBrandId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      const remaining = brands.filter(b => b.brand_id !== deletingBrandId);
      setBrands(remaining);
      if (activeBrandId === deletingBrandId && remaining.length > 0) {
        setActiveBrandId(remaining[0].brand_id);
      }
      setDeleteDialogOpen(false);
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
    } finally {
      setDeleteLoading(false);
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

  const signalColor: Record<string, string> = { high: '#22c55e', medium: '#f59e0b', low: '#94a3b8' };
  const activeBrand = brands.find(b => b.brand_id === activeBrandId);
  const isVoiceLocked = activeBrand?.voice_profile?.locked === true;

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 10 }}>
        <CssBaseline />

        {/* Header */}
        <Box sx={{ borderBottom: '1px solid #363639', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2, position: 'sticky', top: 0, zIndex: 10, bgcolor: '#0f0f10' }}>
          <IconButton onClick={() => router.push('/')} sx={{ color: 'white' }}>
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Zap size={18} /> JamBox
          </Typography>
          <Typography variant="body2" color="text.secondary">/ Brands & Variables</Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => handleSave(true)}
              disabled={saving || generating || contextLoading}
              sx={{ borderRadius: '10px', paddingTop: '11px', paddingBottom: '12px' }}
            >
              {generating ? 'Generating…' : 'Save & Generate Now'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSave(false)}
              disabled={saving || generating}
              sx={{ borderRadius: '10px', borderColor: '#363639', color: 'white', paddingTop: '11px', paddingBottom: '12px' }}
            >
              Save
            </Button>
          </Box>
        </Box>

        <Container maxWidth="md" sx={{ pt: 4 }}>

          {/* Brand selector with management */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, fontSize: '0.7rem' }}>
              Brand
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {brands.map(b => (
                <Box key={b.brand_id} sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <Chip
                    label={b.brand_name}
                    onClick={() => setActiveBrandId(b.brand_id)}
                    color={b.brand_id === activeBrandId ? 'primary' : 'default'}
                    variant={b.brand_id === activeBrandId ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer', pr: b.brand_id === activeBrandId ? 1 : undefined }}
                  />
                  {b.brand_id === activeBrandId && (
                    <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5 }}>
                      <Tooltip title="Edit brand">
                        <IconButton
                          size="small"
                          onClick={() => { setEditingBrand(b); setBrandModalOpen(true); }}
                          sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5, '&:hover': { color: 'white' } }}
                        >
                          <Edit2 size={12} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete brand">
                        <IconButton
                          size="small"
                          onClick={() => { setDeletingBrandId(b.brand_id); setDeleteDialogOpen(true); }}
                          sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5, '&:hover': { color: '#ef4444' } }}
                        >
                          <Trash2 size={12} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              ))}
              <Chip
                label="+ New Brand"
                onClick={() => { setEditingBrand(null); setBrandModalOpen(true); }}
                variant="outlined"
                sx={{ cursor: 'pointer', borderStyle: 'dashed', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)', color: 'white' } }}
              />
            </Box>

          </Box>

          {statusMsg && (
            <Alert severity={statusMsg.startsWith('❌') ? 'error' : statusMsg.startsWith('✅') ? 'success' : 'info'} sx={{ mb: 3 }} onClose={() => setStatusMsg('')}>
              {statusMsg.replace(/^[✅❌🚀]\s*/, '')}
            </Alert>
          )}

          {/* Section: Voice Builder */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Mic size={16} />
                <Typography fontWeight="bold">Voice Builder</Typography>
                {isVoiceLocked
                  ? <Chip label="Locked" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '0.65rem' }} />
                  : <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Iterative voice tuning</Typography>
                }
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {isVoiceLocked
                  ? 'A synthesized voice brief is being injected into every concept generation for this brand.'
                  : "Describe this brand's voice, generate sample captions, vote YES/NO, and iterate until it feels right. Lock the voice to inject it into all generations."
                }
              </Typography>
              {isVoiceLocked && activeBrand?.brand_identity_doc && (
                <Typography variant="body2" sx={{ p: 2, bgcolor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', mb: 2, lineHeight: 1.7 }}>
                  {activeBrand.brand_identity_doc}
                </Typography>
              )}
              <Button
                variant="outlined"
                onClick={() => router.push(`/brands/${activeBrandId}/voice`)}
                endIcon={<Mic size={14} />}
                sx={{
                  borderRadius: '10px',
                  borderColor: isVoiceLocked ? 'rgba(34,197,94,0.4)' : '#363639',
                  color: isVoiceLocked ? '#22c55e' : 'white',
                  paddingTop: '11px',
                  paddingBottom: '12px',
                }}
              >
                {isVoiceLocked ? 'Edit Voice Builder' : 'Open Voice Builder'}
              </Button>
            </AccordionDetails>
          </Accordion>

          {/* Section: Creative Foundation */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Sliders size={16} />
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
                    <Button onClick={() => addChip(pushTopics, setPushTopics, pushInput, setPushInput)} variant="outlined" size="small" sx={{ borderRadius: 10 }}>
                      <Plus size={16} />
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
                    <Button onClick={() => addChip(avoidTopics, setAvoidTopics, avoidInput, setAvoidInput)} variant="outlined" size="small" color="error" sx={{ borderRadius: 10 }}>
                      <Plus size={16} />
                    </Button>
                  </Box>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Post Categories */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TrendingUp size={16} />
                <Typography fontWeight="bold">Post Categories</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Drive concept variety</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Default categories are always active. Add custom ones specific to this brand — they'll be used by the AI to vary daily concept types.
              </Typography>

              <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                Default categories
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {DEFAULT_CATEGORIES.map(cat => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    size="small"
                    sx={{ bgcolor: `${cat.color}18`, border: `1px solid ${cat.color}44`, color: cat.color, cursor: 'default' }}
                  />
                ))}
              </Box>

              <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                Custom categories for this brand
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {customCategories.map(cat => (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    onDelete={() => setCustomCategories(customCategories.filter(c => c.id !== cat.id))}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                ))}
                {customCategories.length === 0 && (
                  <Typography variant="caption" color="text.disabled">No custom categories yet.</Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="e.g. Brand collab, Limited drop, Store event"
                  value={customCategoryInput}
                  onChange={e => setCustomCategoryInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
                  sx={{ flexGrow: 1 }}
                />
                <Button onClick={addCustomCategory} variant="outlined" size="small" sx={{ borderRadius: 10 }}>
                  <Plus size={16} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Public Topic Alignment */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TrendingUp size={16} color="#f59e0b" />
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
                <Button onClick={() => addChip(publicTopics, setPublicTopics, publicTopicInput, setPublicTopicInput)} variant="outlined" size="small" sx={{ borderRadius: 10, borderColor: '#f59e0b', color: '#f59e0b' }}>
                  <Plus size={16} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Locations */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MapPin size={16} color="#22c55e" />
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
                <Button onClick={() => addChip(locations, setLocations, locationInput, setLocationInput)} variant="outlined" size="small" sx={{ borderRadius: 10, borderColor: '#22c55e', color: '#22c55e' }}>
                  <Plus size={16} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Temporal / Calendar Context */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                <Calendar size={16} color="#8b5cf6" />
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
                  startIcon={contextLoading ? <CircularProgress size={12} /> : <RefreshCw size={14} />}
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
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, bgcolor: entry.custom ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${entry.custom ? 'rgba(139,92,246,0.2)' : 'transparent'}` }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={entry.custom || entry.source === 'culture_calendar' ? 600 : 400}>
                          {entry.label}
                          {entry.source === 'culture_calendar' && <Chip icon={<Calendar size={9} />} label="Culture Calendar" size="small" sx={{ ml: 1, fontSize: '0.6rem', bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', '& .MuiChip-icon': { color: '#8b5cf6' } }} />}
                          {entry.custom && <Chip label="custom" size="small" sx={{ ml: 1, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }} />}
                        </Typography>
                        {entry.date && <Typography variant="caption" color="text.disabled">{entry.date}</Typography>}
                        {entry.relevance && <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>{entry.relevance}</Typography>}
                      </Box>
                      <IconButton size="small" onClick={() => setTemporalContext(temporalContext.filter((_, j) => j !== i))}>
                        <X size={14} />
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
                <Button onClick={addCustomTemporal} variant="outlined" size="small" sx={{ borderRadius: 10, borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                  <Plus size={16} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Trend Signals */}
          <Accordion sx={{ mb: 4 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                <TrendingUp size={16} />
                <Typography fontWeight="bold">Trend Signals</Typography>
                <Chip label="Auto-generated weekly" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', ml: 1 }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Auto-generated based on today's date and brand locations. Add your own below.
              </Typography>

              {trendSignals.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No trend signals yet. Click "Regenerate" in the Calendar Context section above to generate both.
                </Alert>
              ) : (() => {
                const national = trendSignals.filter((s: any) => !s.scope || s.scope === 'national');
                const local = trendSignals.filter((s: any) => s.scope === 'local');
                const renderSignal = (signal: any, i: number, originalIdx: number) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, bgcolor: signal.custom ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${signal.custom ? 'rgba(59,130,246,0.2)' : 'transparent'}` }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: signalColor[signal.strength] || '#94a3b8', flexShrink: 0, mt: 0.7 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{signal.signal}</Typography>
                      <Typography variant="caption" color="text.disabled">{signal.source}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                      <Chip label={signal.strength} size="small" sx={{ fontSize: '0.6rem', bgcolor: `${signalColor[signal.strength]}22`, color: signalColor[signal.strength], border: `1px solid ${signalColor[signal.strength]}44` }} />
                      <IconButton size="small" onClick={() => setTrendSignals(trendSignals.filter((_, j) => j !== originalIdx))}>
                        <X size={13} />
                      </IconButton>
                    </Box>
                  </Box>
                );
                return (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
                        <Globe size={12} /> National
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                        {national.length === 0
                          ? <Typography variant="caption" color="text.disabled">No national signals.</Typography>
                          : national.map((s: any, i: number) => renderSignal(s, i, trendSignals.indexOf(s)))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField size="small" placeholder="Add national trend"
                          value={customNationalInput} onChange={e => setCustomNationalInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomSignal(customNationalInput, setCustomNationalInput, 'national')}
                          sx={{ flexGrow: 1 }} inputProps={{ style: { fontSize: '0.78rem' } }} />
                        <Button onClick={() => addCustomSignal(customNationalInput, setCustomNationalInput, 'national')} variant="outlined" size="small" sx={{ borderRadius: 10, minWidth: 36, px: 1 }}>
                          <Plus size={16} />
                        </Button>
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontWeight: 700, color: '#22c55e', letterSpacing: 0.5 }}>
                        <MapPin size={12} /> Local{locations.length > 0 ? ` — ${locations.slice(0, 2).join(', ')}${locations.length > 2 ? '…' : ''}` : ''}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                        {local.length === 0
                          ? <Typography variant="caption" color="text.disabled">{locations.length === 0 ? 'Add locations above, then Regenerate.' : 'No local signals yet — click Regenerate.'}</Typography>
                          : local.map((s: any, i: number) => renderSignal(s, i, trendSignals.indexOf(s)))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField size="small" placeholder="Add local trend"
                          value={customLocalInput} onChange={e => setCustomLocalInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomSignal(customLocalInput, setCustomLocalInput, 'local')}
                          sx={{ flexGrow: 1 }} inputProps={{ style: { fontSize: '0.78rem' } }} />
                        <Button onClick={() => addCustomSignal(customLocalInput, setCustomLocalInput, 'local')} variant="outlined" size="small" sx={{ borderRadius: 10, minWidth: 36, px: 1, borderColor: '#22c55e', color: '#22c55e' }}>
                          <Plus size={16} />
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              {sproutConnected === false && (
                <Alert severity="warning" sx={{ mt: 2 }} icon={false}>
                  <Typography variant="body2" fontWeight={600}>Sprout Social not connected</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Trend data is mock. Add <code>SPROUT_API_TOKEN</code> and <code>SPROUT_PROFILE_ID_{activeBrandId.toUpperCase().replace(/-/g, '_')}</code> to enable live audience trends.
                  </Typography>
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Section: Menu Items */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Coffee size={16} color="#f97316" />
                <Typography fontWeight="bold">Menu Items / Products</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Scope generations to specific products</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add the products or menu items this brand sells. Concepts will be generated around these items.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {menuItems.map(item => (
                  <Chip key={item} label={item} onDelete={() => setMenuItems(menuItems.filter(x => x !== item))} size="small"
                    sx={{ bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }} />
                ))}
                {menuItems.length === 0 && <Typography variant="caption" color="text.disabled">No products added yet.</Typography>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" placeholder="e.g. Honey Chipotle Shrimp Taco, Old Skool Black"
                  value={menuItemInput} onChange={e => setMenuItemInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip(menuItems, setMenuItems, menuItemInput, setMenuItemInput)}
                  sx={{ flexGrow: 1 }} />
                <Button onClick={() => addChip(menuItems, setMenuItems, menuItemInput, setMenuItemInput)}
                  variant="outlined" size="small" sx={{ borderRadius: 10, borderColor: '#f97316', color: '#f97316' }}>
                  <Plus size={16} />
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Section: Brand Resource Links */}
          <Accordion sx={{ mb: 4 }}>
            <AccordionSummary expandIcon={<ChevronDown size={16} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Link size={16} color="#94a3b8" />
                <Typography fontWeight="bold">Brand Resource Links</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>Google Sheets & Drive integrations</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Culture Calendar — Google Sheets URL</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
                    Read on every "Regenerate". Expected columns: Date | Event/Label | Relevance | Type
                  </Typography>
                  <TextField fullWidth size="small" placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={cultureCalendarUrl} onChange={e => setCultureCalendarUrl(e.target.value)}
                    InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>PDP Images — Google Drive Folder URL</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
                    Naming convention: <code style={{ color: '#f97316' }}>{'{brand}_{category}_{product-name}.{ext}'}</code>
                  </Typography>
                  <TextField fullWidth size="small" placeholder="https://drive.google.com/drive/folders/…"
                    value={pdpFolderUrl} onChange={e => setPdpFolderUrl(e.target.value)}
                    InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }} />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Save actions at bottom */}
          <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid #363639' }}>
            <Button variant="contained" onClick={() => handleSave(true)} disabled={saving || generating || contextLoading}
              sx={{ borderRadius: '10px', flex: 1, paddingTop: '11px', paddingBottom: '12px' }}>
              {generating ? 'Generating…' : 'Save & Generate Now'}
            </Button>
            <Button variant="outlined" onClick={() => handleSave(false)} disabled={saving || generating}
              sx={{ borderRadius: '10px', borderColor: '#363639', color: 'white', paddingTop: '11px', paddingBottom: '12px' }}>
              Save
            </Button>
            <Button onClick={() => router.push('/')} color="inherit" sx={{ borderRadius: '10px' }}>Back</Button>
          </Box>
        </Container>
      </Box>

      {/* Brand create/edit modal */}
      <BrandModal
        open={brandModalOpen}
        brand={editingBrand}
        onClose={() => setBrandModalOpen(false)}
        onSaved={(saved) => {
          setBrandModalOpen(false);
          if (editingBrand) {
            setBrands(prev => prev.map(b => b.brand_id === saved.brand_id ? saved : b));
          } else {
            setBrands(prev => [...prev, saved]);
            setActiveBrandId(saved.brand_id);
          }
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1c1c1d', border: '1px solid #363639', borderRadius: '16px' } }}
      >
        <DialogTitle>Delete brand?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will hide <strong>{brands.find(b => b.brand_id === deletingBrandId)?.brand_name}</strong> from the dashboard. Existing concepts are preserved. This can be reversed from the database if needed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" sx={{ borderRadius: '10px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeleteBrand}
            disabled={deleteLoading}
            sx={{ borderRadius: '10px', bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, color: 'white' }}
          >
            {deleteLoading ? <CircularProgress size={16} color="inherit" /> : 'Delete Brand'}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default function VariablesPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0f0f10' }}>
        <CircularProgress />
      </Box>
    }>
      <VariablesPageInner />
    </Suspense>
  );
}

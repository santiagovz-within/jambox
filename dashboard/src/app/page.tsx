"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Grid, Card, CardContent,
  CardMedia, CardActions, Chip, Drawer, Box, CssBaseline, Skeleton, Fade,
  Menu, MenuItem, Button, Alert, IconButton, Tooltip, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { ChevronDown, Sliders, Zap, Check, X, Edit, ExternalLink } from 'react-feather';
import { getCategoryLabel } from '../lib/categories';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import VariablesPanel from '../components/VariablesPanel';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0f0f10', paper: '#1c1c1d' },
    primary: { main: '#ffffff', light: 'rgba(255,255,255,0.8)', dark: 'rgba(255,255,255,0.9)', contrastText: '#111111' },
    secondary: { main: '#8b5cf6' },
  },
  shape: { borderRadius: 20 },
  typography: {
    fontFamily: 'inherit',
    button: { textTransform: 'none', fontWeight: 600, lineHeight: 1 }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #363639',
        }
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { lineHeight: 1, paddingTop: 8, paddingBottom: 9 }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { paddingBottom: '2px' }
      }
    },
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
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0f0f10',
          boxShadow: 'none',
          borderBottom: '1px solid #363639',
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: '#1c1c1d',
          borderLeft: '1px solid #363639',
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1c1c1d',
          border: '1px solid #363639',
          borderRadius: '10px',
          marginTop: 8,
        }
      }
    }
  }
});

function getRecentMonths() {
  const months: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const year = d.getFullYear();
    const mon = d.getMonth() + 1;
    months.push({
      value: `${year}-${String(mon).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDayHeader(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  if (dateStr === today) return `Today · ${label}`;
  if (dateStr === yesterday) return `Yesterday · ${label}`;
  return label;
}

function groupByDate(concepts: any[]): { date: string; items: any[] }[] {
  const map = new Map<string, any[]>();
  for (const c of concepts) {
    const d = c.date || 'unknown';
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(c);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

function statusColor(status: string): 'success' | 'error' | 'default' {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected') return 'error';
  return 'default';
}

export default function DashboardHome() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [actionStates, setActionStates] = useState<Record<string, string>>({});

  const [brands, setBrands] = useState<{ brand_id: string; brand_name: string }[]>([]);
  const [activeBrand, setActiveBrand] = useState('fuzzys_taco_shop');
  const [activeMonth, setActiveMonth] = useState(currentMonth);

  const [brandAnchor, setBrandAnchor] = useState<null | HTMLElement>(null);
  const [monthAnchor, setMonthAnchor] = useState<null | HTMLElement>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const recentMonths = getRecentMonths();
  const activeBrandName = brands.find(b => b.brand_id === activeBrand)?.brand_name || activeBrand;
  const activeMonthLabel = recentMonths.find(m => m.value === activeMonth)?.label || activeMonth;
  const isCurrentMonth = activeMonth === currentMonth();

  useEffect(() => {
    fetch('/api/brands')
      .then(r => r.json())
      .then(d => { if (d.brands) setBrands(d.brands); })
      .catch(() => {});
  }, []);

  const fetchConcepts = useCallback(() => {
    setLoading(true);
    setFetchError('');
    fetch(`/api/concepts?brand_id=${activeBrand}&month=${activeMonth}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setFetchError(d.error);
          setConcepts([]);
        } else if (d.concepts) {
          setConcepts(d.concepts.map((c: any) => ({
            id: c.id,
            date: c.date,
            platform: c.platform || 'Unknown',
            content_type: c.content_type || '',
            status: c.status === 'approved' ? 'Approved' : c.status === 'rejected' ? 'Rejected' : 'Pending',
            copy: c.copy || '',
            rationale: c.rationale || '',
            sprout_data_notes: c.sprout_data_notes || '',
            confidence_score: c.confidence_score,
            images: c.generated_images?.map((img: any) => img.image_url).filter(Boolean) || [],
            category: c.category || '',
          })));
        } else {
          setConcepts([]);
        }
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [activeBrand, activeMonth]);

  useEffect(() => { fetchConcepts(); }, [fetchConcepts]);

  const handleAction = async (conceptId: string, action: 'approve' | 'reject') => {
    setActionStates(s => ({ ...s, [conceptId]: action }));
    try {
      const res = await fetch(`/api/concepts/${conceptId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.status === 409) {
        // Already decided (e.g. via Slack) — sync from server
        const data = await res.json();
        const serverStatus = data.status === 'approved' ? 'Approved' : data.status === 'rejected' ? 'Rejected' : 'Pending';
        setConcepts(prev => prev.map(c => c.id === conceptId ? { ...c, status: serverStatus } : c));
        setActionStates(s => { const n = { ...s }; delete n[conceptId]; return n; });
        return;
      }

      if (!res.ok) throw new Error('Action failed');

      setConcepts(prev => prev.map(c =>
        c.id === conceptId
          ? { ...c, status: action === 'approve' ? 'Approved' : 'Rejected' }
          : c
      ));
    } catch {
      setActionStates(s => { const n = { ...s }; delete n[conceptId]; return n; });
    }
  };

  const pageTitle = isCurrentMonth
    ? "Today's Concepts"
    : `${activeMonthLabel} Concepts`;

  const statusFiltered = statusFilter === 'all' ? concepts : concepts.filter(c => c.status === statusFilter);
  const filteredConcepts = categoryFilter === 'all' ? statusFiltered : statusFiltered.filter(c => c.category === categoryFilter);

  const availableCategories = Array.from(new Set(concepts.map(c => c.category).filter(Boolean))) as string[];

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
        <CssBaseline />
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ pt: 1, pb: 1 }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Zap size={18} /> JamBox
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>

              {/* Brand Dropdown */}
              <Button
                variant="outlined"
                onClick={(e) => setBrandAnchor(e.currentTarget)}
                sx={{ borderRadius: '10px', borderColor: '#363639', color: 'white', px: 2, paddingTop: '8px', paddingBottom: '9px' }}
              >
                Brand: {activeBrandName}
                <ChevronDown size={14} style={{ marginLeft: 8, opacity: 0.7 }} />
              </Button>
              <Menu anchorEl={brandAnchor} open={Boolean(brandAnchor)} onClose={() => setBrandAnchor(null)}>
                {brands.map(b => (
                  <MenuItem key={b.brand_id} selected={b.brand_id === activeBrand}
                    onClick={() => { setActiveBrand(b.brand_id); setBrandAnchor(null); }}>
                    {b.brand_name}
                  </MenuItem>
                ))}
                {brands.length === 0 && <MenuItem disabled>Loading brands…</MenuItem>}
              </Menu>

              {/* Month Dropdown */}
              <Button
                variant="outlined"
                onClick={(e) => setMonthAnchor(e.currentTarget)}
                sx={{ borderRadius: '10px', borderColor: '#363639', color: 'white', px: 2, paddingTop: '8px', paddingBottom: '9px' }}
              >
                {activeMonthLabel}
                <ChevronDown size={14} style={{ marginLeft: 8, opacity: 0.7 }} />
              </Button>
              <Menu anchorEl={monthAnchor} open={Boolean(monthAnchor)} onClose={() => setMonthAnchor(null)}>
                {recentMonths.map(m => (
                  <MenuItem key={m.value} selected={m.value === activeMonth}
                    onClick={() => { setActiveMonth(m.value); setMonthAnchor(null); }}>
                    {m.label}
                  </MenuItem>
                ))}
              </Menu>

              {/* Variables Drawer */}
              <Button
                variant="outlined"
                onClick={() => setDrawerOpen(!drawerOpen)}
                sx={{ borderRadius: '10px', borderColor: '#363639', color: 'white', px: 2, paddingTop: '8px', paddingBottom: '9px' }}
              >
                <Sliders size={16} style={{ marginRight: 8 }} /> Variables
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
          <Container maxWidth="lg">
            <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 'bold' }}>
              {pageTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Generated every day at 10AM
            </Typography>

            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, v) => { if (v !== null) setStatusFilter(v); }}
              size="small"
              sx={{
                mb: 4,
                '& .MuiToggleButton-root': {
                  borderRadius: '10px !important',
                  px: 2.5, paddingTop: '8px', paddingBottom: '9px',
                  border: '1px solid #363639',
                  color: 'rgba(255,255,255,0.6)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  mx: 0.5,
                  '&.Mui-selected': { color: 'white', bgcolor: '#2f2f30', borderColor: '#363639' },
                  '&.Mui-selected:hover': { bgcolor: '#3a3a3b' },
                  '&:first-of-type': { ml: 0 },
                },
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="Pending">Pending</ToggleButton>
              <ToggleButton value="Approved">Approved</ToggleButton>
              <ToggleButton value="Rejected">Declined</ToggleButton>
            </ToggleButtonGroup>

            {availableCategories.length > 0 && (
              <ToggleButtonGroup
                value={categoryFilter}
                exclusive
                onChange={(_, v) => { if (v !== null) setCategoryFilter(v); }}
                size="small"
                sx={{
                  mb: 4, display: 'flex', flexWrap: 'wrap', gap: 0,
                  '& .MuiToggleButton-root': {
                    borderRadius: '10px !important',
                    px: 2, paddingTop: '6px', paddingBottom: '7px',
                    border: '1px solid #363639',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    mx: 0.5,
                    mb: 0.75,
                    '&.Mui-selected': { color: 'white', bgcolor: '#2f2f30', borderColor: '#363639' },
                    '&.Mui-selected:hover': { bgcolor: '#3a3a3b' },
                    '&:first-of-type': { ml: 0 },
                  },
                }}
              >
                <ToggleButton value="all">All categories</ToggleButton>
                {availableCategories.map(cat => (
                  <ToggleButton key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}

            {fetchError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                Failed to load concepts: {fetchError}
              </Alert>
            )}

            {loading ? (
              <Fade in={loading} timeout={500}>
                <Grid container spacing={2}>
                  {[1, 2, 3].map((item) => (
                    <Grid item xs={12} md={4} key={item}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 0 }}>
                        <Skeleton variant="rectangular" height={200} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Skeleton variant="text" width={80} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                          <Skeleton variant="text" width="100%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                          <Skeleton variant="text" width="60%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                        </CardContent>
                        <CardActions sx={{ pb: 2, px: 2 }}>
                          <Skeleton variant="rounded" width={80} height={32} sx={{ borderRadius: 12, bgcolor: 'rgba(255,255,255,0.05)' }} />
                          <Skeleton variant="rounded" width={80} height={32} sx={{ borderRadius: 12, bgcolor: 'rgba(255,255,255,0.05)' }} />
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Fade>
            ) : filteredConcepts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {concepts.length === 0 ? 'No concepts for this period' : `No ${statusFilter === 'Rejected' ? 'declined' : statusFilter.toLowerCase()} concepts`}
                </Typography>
                <Typography variant="body2">
                  {concepts.length === 0
                    ? <>Click <strong>Variables → Save &amp; Generate Now</strong> to create some, or pick a different month.</>
                    : 'Try a different filter above.'}
                </Typography>
              </Box>
            ) : (
              <Fade in={!loading} timeout={800}>
                <Box>
                  {groupByDate(filteredConcepts).map(({ date, items }) => (
                    <Box key={date} sx={{ mb: 6 }}>
                      <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: 1.5, fontWeight: 700, display: 'block', mb: 2, borderBottom: '1px solid #363639', pb: 1 }}>
                        {formatDayHeader(date)}
                      </Typography>
                      <Grid container spacing={2} sx={{ pt: 1 }}>
                  {items.map((concept) => (
                    <Grid item xs={12} md={4} key={concept.id}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {concept.images.length > 0 && (
                          <CardMedia
                            component="img"
                            height="200"
                            image={concept.images[0]}
                            alt="Concept visual"
                            sx={{ objectFit: 'cover', cursor: 'pointer' }}
                            onClick={() => router.push(`/concepts/${concept.id}`)}
                          />
                        )}
                        <CardContent sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => router.push(`/concepts/${concept.id}`)}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                {concept.platform}
                              </Typography>
                              {concept.content_type && (
                                <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'capitalize' }}>
                                  · {concept.content_type.replace('_', ' ')}
                                </Typography>
                              )}
                              {concept.category && (
                                <Chip
                                  label={getCategoryLabel(concept.category)}
                                  size="small"
                                  sx={{ fontSize: '0.65rem', height: 18, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                />
                              )}
                            </Box>
                            <Chip label={concept.status} size="small" color={statusColor(concept.status)} />
                          </Box>
                          <Typography variant="body1" sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            "{concept.copy}"
                          </Typography>
                          {concept.rationale && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                              {concept.rationale}
                            </Typography>
                          )}
                        </CardContent>

                        <CardActions sx={{ pb: 2, px: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {/* YES */}
                            <Button
                              size="small"
                              variant="contained"
                              disableElevation
                              onClick={() => handleAction(concept.id, 'approve')}
                              disabled={!!actionStates[concept.id] || concept.status !== 'Pending'}
                              sx={{
                                minWidth: 0, px: 1.5, boxShadow: 'none',
                                backgroundColor: concept.status === 'Approved' ? '#3a3a3c' : concept.status === 'Rejected' ? '#222224' : 'rgba(34,197,94,0.12)',
                                color: concept.status === 'Approved' ? 'rgba(255,255,255,0.75)' : concept.status === 'Rejected' ? 'rgba(255,255,255,0.2)' : '#22c55e',
                                '&:hover': { backgroundColor: concept.status === 'Pending' ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.1)', boxShadow: 'none' },
                                '&.Mui-disabled': {
                                  backgroundColor: concept.status === 'Approved' ? '#3a3a3c' : '#222224',
                                  color: concept.status === 'Approved' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)',
                                },
                              }}
                            >
                              <Check size={14} style={{ marginRight: 4 }} /> YES
                            </Button>

                            {/* NO */}
                            <Button
                              size="small"
                              variant="contained"
                              disableElevation
                              onClick={() => handleAction(concept.id, 'reject')}
                              disabled={!!actionStates[concept.id] || concept.status !== 'Pending'}
                              sx={{
                                minWidth: 0, px: 1.5, boxShadow: 'none',
                                backgroundColor: concept.status === 'Rejected' ? '#3a3a3c' : concept.status === 'Approved' ? '#222224' : 'rgba(239,68,68,0.12)',
                                color: concept.status === 'Rejected' ? 'rgba(255,255,255,0.75)' : concept.status === 'Approved' ? 'rgba(255,255,255,0.2)' : '#ef4444',
                                '&:hover': { backgroundColor: concept.status === 'Pending' ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.1)', boxShadow: 'none' },
                                '&.Mui-disabled': {
                                  backgroundColor: concept.status === 'Rejected' ? '#3a3a3c' : '#222224',
                                  color: concept.status === 'Rejected' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)',
                                },
                              }}
                            >
                              <X size={14} style={{ marginRight: 4 }} /> NO
                            </Button>

                            {/* EDIT & APPROVE */}
                            <Tooltip title="Edit & Approve">
                              <IconButton
                                size="small"
                                onClick={() => router.push(`/concepts/${concept.id}`)}
                                sx={{ border: '1px solid #363639', borderRadius: '10px' }}
                              >
                                <Edit size={14} />
                              </IconButton>
                            </Tooltip>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(concept.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Typography>
                            {concept.confidence_score && (
                              <Typography variant="caption" color="text.disabled">
                                {Math.round(concept.confidence_score * 100)}%
                              </Typography>
                            )}
                            <Tooltip title="Open detail">
                              <IconButton size="small" onClick={() => router.push(`/concepts/${concept.id}`)}>
                                <ExternalLink size={12} style={{ opacity: 0.4 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                    </Box>
                  ))}
                </Box>
              </Fade>
            )}
          </Container>
        </Box>

        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          variant="temporary"
          sx={{
            width: 400,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: 400, boxSizing: 'border-box', p: 2, mt: 8 },
          }}
        >
          <VariablesPanel onClose={() => { setDrawerOpen(false); fetchConcepts(); }} activeBrandId={activeBrand} />
        </Drawer>
      </Box>
    </ThemeProvider>
  );
}

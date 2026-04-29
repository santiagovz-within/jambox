"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Grid, Card, CardContent,
  CardMedia, CardActions, Chip, Drawer, Box, CssBaseline, Skeleton, Fade,
  Menu, MenuItem, Button, Alert, IconButton, Tooltip
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown, faSliders, faWandMagicSparkles,
  faCheck, faXmark, faPenToSquare, faArrowUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import VariablesPanel from '../components/VariablesPanel';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0A0A0A', paper: '#141414' },
    primary: { main: '#3B82F6' },
    secondary: { main: '#8b5cf6' },
  },
  shape: { borderRadius: 24 },
  typography: {
    fontFamily: 'inherit',
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0A0A0A',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: '#141414',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e1e1e',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
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

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    ? `Today's Concepts — ${todayLabel()}`
    : `${activeMonthLabel} Concepts`;

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
        <CssBaseline />
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ pt: 1, pb: 1 }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#3B82F6' }} /> JamBox
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>

              {/* Brand Dropdown */}
              <Button
                variant="outlined"
                onClick={(e) => setBrandAnchor(e.currentTarget)}
                sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', px: 2, py: 0.5 }}
              >
                Brand: {activeBrandName}
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65em', marginLeft: 8, opacity: 0.7 }} />
              </Button>
              <Menu anchorEl={brandAnchor} open={Boolean(brandAnchor)} onClose={() => setBrandAnchor(null)}>
                {brands.map(b => (
                  <MenuItem key={b.brand_id} selected={b.brand_id === activeBrand}
                    onClick={() => { setActiveBrand(b.brand_id); setBrandAnchor(null); }} sx={{ borderRadius: 1 }}>
                    {b.brand_name}
                  </MenuItem>
                ))}
                {brands.length === 0 && <MenuItem disabled>Loading brands…</MenuItem>}
              </Menu>

              {/* Month Dropdown */}
              <Button
                variant="outlined"
                onClick={(e) => setMonthAnchor(e.currentTarget)}
                sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', px: 2, py: 0.5 }}
              >
                {activeMonthLabel}
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65em', marginLeft: 8, opacity: 0.7 }} />
              </Button>
              <Menu anchorEl={monthAnchor} open={Boolean(monthAnchor)} onClose={() => setMonthAnchor(null)}>
                {recentMonths.map(m => (
                  <MenuItem key={m.value} selected={m.value === activeMonth}
                    onClick={() => { setActiveMonth(m.value); setMonthAnchor(null); }} sx={{ borderRadius: 1 }}>
                    {m.label}
                  </MenuItem>
                ))}
              </Menu>

              {/* Variables Drawer */}
              <Button
                variant="outlined"
                onClick={() => setDrawerOpen(!drawerOpen)}
                sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', px: 2, py: 0.5 }}
              >
                <FontAwesomeIcon icon={faSliders} style={{ marginRight: 8, color: '#3B82F6' }} /> Variables
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
          <Container maxWidth="lg">
            <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 'bold' }}>
              {pageTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Generated every day at 10AM
            </Typography>

            {fetchError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                Failed to load concepts: {fetchError}
              </Alert>
            )}

            {loading ? (
              <Fade in={loading} timeout={500}>
                <Grid container spacing={4}>
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
            ) : concepts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>No concepts for this period</Typography>
                <Typography variant="body2">
                  Click <strong>Variables → Save &amp; Generate Now</strong> to create some, or pick a different month.
                </Typography>
              </Box>
            ) : (
              <Fade in={!loading} timeout={800}>
                <Box>
                  {groupByDate(concepts).map(({ date, items }) => (
                    <Box key={date} sx={{ mb: 6 }}>
                      <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: 1.5, fontWeight: 700, display: 'block', mb: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 1 }}>
                        {formatDayHeader(date)}
                      </Typography>
                      <Grid container spacing={4}>
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
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                {concept.platform}
                              </Typography>
                              {concept.content_type && (
                                <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'capitalize' }}>
                                  · {concept.content_type.replace('_', ' ')}
                                </Typography>
                              )}
                            </Box>
                            <Chip label={concept.status} size="small" color={statusColor(concept.status)} />
                          </Box>
                          <Typography variant="body1" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                              variant={concept.status === 'Approved' ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() => handleAction(concept.id, 'approve')}
                              disabled={!!actionStates[concept.id] || concept.status !== 'Pending'}
                              sx={{ borderRadius: 12, minWidth: 0, px: 1.5 }}
                            >
                              <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} /> YES
                            </Button>

                            {/* NO */}
                            <Button
                              size="small"
                              variant={concept.status === 'Rejected' ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => handleAction(concept.id, 'reject')}
                              disabled={!!actionStates[concept.id] || concept.status !== 'Pending'}
                              sx={{ borderRadius: 12, minWidth: 0, px: 1.5 }}
                            >
                              <FontAwesomeIcon icon={faXmark} style={{ marginRight: 4 }} /> NO
                            </Button>

                            {/* EDIT & APPROVE */}
                            <Tooltip title="Edit & Approve">
                              <IconButton
                                size="small"
                                onClick={() => router.push(`/concepts/${concept.id}`)}
                                sx={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8 }}
                              >
                                <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: '0.85em' }} />
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
                                <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: '0.75em', opacity: 0.4 }} />
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

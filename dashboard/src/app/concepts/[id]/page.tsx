"use client";

import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, Chip, Alert, CircularProgress,
  Divider, TextField, Card, CardMedia, Grid, IconButton, Tooltip,
  CssBaseline, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ArrowLeft, Check, X, Edit2, Image as ImageIcon, Video, Zap, BarChart2, Trash2, Copy, FileText, Eye, Star, Lock } from 'react-feather';
import { useRouter, useParams } from 'next/navigation';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0A0A0A', paper: '#141414' },
    primary: { main: '#3B82F6' },
    secondary: { main: '#8b5cf6' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: 'inherit',
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
        }
      }
    }
  }
});

type ConceptStatus = 'pending' | 'approved' | 'rejected';

function formatContentType(ct: string) {
  const map: Record<string, string> = {
    reel: 'Reel', tiktok_video: 'TikTok Video', carousel: 'Carousel',
    static: 'Post', video_script: 'Video Script', story: 'Story',
  };
  return map[ct] || ct;
}

function statusColor(s: string): 'success' | 'error' | 'default' {
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'error';
  return 'default';
}

export default function ConceptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [concept, setConcept] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action state
  const [actionLoading, setActionLoading] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedCopy, setEditedCopy] = useState('');

  // Image gen
  const [imageGenLoading, setImageGenLoading] = useState(false);
  const [imageGenError, setImageGenError] = useState('');
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [outputFormat, setOutputFormat] = useState('JPG');

  // Video gen
  const [videoGenLoading, setVideoGenLoading] = useState(false);
  const [videoGenError, setVideoGenError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedImageForVideo, setSelectedImageForVideo] = useState('');

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy to clipboard
  const [copied, setCopied] = useState(false);
  const handleCopyCopy = () => {
    const text = concept?.edited_copy || concept?.copy || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    fetch(`/api/concepts/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setConcept(d.concept);
        setEditedCopy(d.concept?.edited_copy || d.concept?.copy || '');
        const imgs = d.concept?.generated_images || [];
        setGeneratedImages(imgs);
        if (imgs.length > 0) setSelectedImageForVideo(imgs[0].image_url);
        setVideoUrl(d.concept?.generated_video_url || '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: 'approve' | 'reject' | 'edit') => {
    setActionLoading(action);
    try {
      const body: any = { action };
      if (action === 'edit') body.edited_copy = editedCopy;

      const res = await fetch(`/api/concepts/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setConcept((prev: any) => ({ ...prev, status: data.status, edited_copy: action === 'edit' ? editedCopy : prev.edited_copy }));
      if (action === 'edit') setEditMode(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleGenerateImages = async () => {
    setImageGenLoading(true);
    setImageGenError('');
    try {
      const res = await fetch(`/api/concepts/${id}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspectRatio, outputFormat }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error(`Server error (non-JSON response). Check Vercel logs for details.`);
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const imageUrl = data.image_url || data.images?.[0]?.url;
      if (imageUrl) {
        setGeneratedImages([{ image_url: imageUrl, variation_label: 'A' }]);
        setSelectedImageForVideo(imageUrl);
      }
    } catch (e: any) {
      setImageGenError(e.message);
    } finally {
      setImageGenLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!selectedImageForVideo) return;
    setVideoGenLoading(true);
    setVideoGenError('');
    try {
      const res = await fetch(`/api/concepts/${id}/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: selectedImageForVideo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed');
      setVideoUrl(data.video_url);
    } catch (e: any) {
      setVideoGenError(e.message);
    } finally {
      setVideoGenLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/concepts/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      router.push('/');
    } catch (e: any) {
      setError(e.message);
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
          <CssBaseline />
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  if (error && !concept) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box sx={{ p: 4, bgcolor: 'background.default', minHeight: '100vh' }}>
          <CssBaseline />
          <Alert severity="error">{error}</Alert>
          <Button onClick={() => router.push('/')} sx={{ mt: 2 }}>← Back</Button>
        </Box>
      </ThemeProvider>
    );
  }

  const isPending = concept?.status === 'pending';

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
        <CssBaseline />

        {/* Header */}
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => router.push('/')} sx={{ color: 'white' }}>
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Zap size={18} color="#3B82F6" /> JamBox
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            / Concept Detail
          </Typography>
        </Box>

        <Container maxWidth="md" sx={{ pt: 4 }}>

          {/* Title + Status */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                {concept?.platform && <span style={{ textTransform: 'capitalize' }}>{concept.platform}</span>}
                {concept?.content_type && ` — ${formatContentType(concept.content_type)}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {concept?.date && new Date(concept.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {concept?.confidence_score && ` · ${Math.round(concept.confidence_score * 100)}% confidence`}
                {concept?.brand_id && ` · ${concept.brand_id}`}
              </Typography>
            </Box>
            <Chip
              label={concept?.status ? concept.status.charAt(0).toUpperCase() + concept.status.slice(1) : 'Pending'}
              color={statusColor(concept?.status || 'pending')}
            />
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<Check size={16} />}
              onClick={() => handleAction('approve')}
              disabled={!!actionLoading || !isPending}
              sx={{ borderRadius: '16px' }}
            >
              {actionLoading === 'approve' ? 'Approving…' : 'YES — Approve'}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<X size={16} />}
              onClick={() => handleAction('reject')}
              disabled={!!actionLoading || !isPending}
              sx={{ borderRadius: '16px' }}
            >
              {actionLoading === 'reject' ? 'Declining…' : 'NO — Decline'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Edit2 size={16} />}
              onClick={() => setEditMode(!editMode)}
              disabled={!!actionLoading}
              sx={{ borderRadius: '16px', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Edit & Approve
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="outlined"
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ borderRadius: '16px', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
            >
              Delete concept
            </Button>
          </Box>

          {/* Edit mode */}
          {editMode && (
            <Box sx={{ mb: 4, p: 3, bgcolor: '#1e1e1e', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Edit Copy</Typography>
              <TextField
                multiline
                rows={5}
                fullWidth
                value={editedCopy}
                onChange={e => setEditedCopy(e.target.value)}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleAction('edit')}
                  disabled={!!actionLoading}
                  sx={{ borderRadius: '16px' }}
                >
                  {actionLoading === 'edit' ? 'Saving…' : 'Confirm Approval with Edits'}
                </Button>
                <Button onClick={() => setEditMode(false)} sx={{ borderRadius: '16px', color: 'text.secondary' }}>
                  Cancel
                </Button>
              </Box>
            </Box>
          )}

          <Divider sx={{ mb: 4 }} />

          {/* Concept Fields */}
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0 }}>
                  <Typography variant="overline" color="primary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <FileText size={13} /> COPY
                  </Typography>
                  <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                    <IconButton size="small" onClick={handleCopyCopy} sx={{ color: copied ? '#22c55e' : 'text.disabled' }}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body1" sx={{ mt: 1, p: 2.5, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', lineHeight: 1.7, fontSize: '1.05rem', fontWeight: 600 }}>
                  {concept?.edited_copy || concept?.copy}
                </Typography>
                {concept?.edited_copy && concept.edited_copy !== concept.copy && (
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    ✏️ Edited from original
                  </Typography>
                )}
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="overline" color="secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Eye size={13} /> VISUAL DIRECTION
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                  {concept?.visual_direction}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Star size={13} /> WHY THIS WORKS
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                  {concept?.rationale}
                </Typography>
                {concept?.trend_hook && (
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                    Trend hook: {concept.trend_hook}
                  </Typography>
                )}
              </Box>

              <Box sx={{ mb: 4, p: 2.5, bgcolor: 'rgba(59, 130, 246, 0.05)', borderRadius: 2, border: '1px solid rgba(59,130,246,0.15)' }}>
                <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChart2 size={16} /> SPROUT AI DATA BACKING NOTES
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                  {concept?.sprout_data_notes || 'No Sprout Social data available. Set SPROUT_API_TOKEN in environment variables to enable live data backing.'}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 4 }} />

          {/* Image Generation Section */}
          <Box sx={{ mb: 6 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImageIcon size={18} color="#3B82F6" /> Image Generation
            </Typography>

            {/* Suggested prompt */}
            <Box sx={{ mb: 3, p: 2, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                AI image prompt
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {concept?.image_gen_prompt || 'No image generation prompt available.'}
              </Typography>
            </Box>

            {imageGenError && <Alert severity="error" sx={{ mb: 2 }}>{imageGenError}</Alert>}

            {generatedImages.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {/* Left: controls */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <FormControl size="small" disabled={imageGenLoading}>
                    <InputLabel>Aspect Ratio</InputLabel>
                    <Select
                      value={aspectRatio}
                      label="Aspect Ratio"
                      onChange={e => setAspectRatio(e.target.value)}
                      sx={{ minWidth: 168, borderRadius: 2 }}
                    >
                      <MenuItem value="1:1">1:1 Square</MenuItem>
                      <MenuItem value="9:16">9:16 Vertical</MenuItem>
                      <MenuItem value="16:9">16:9 Horizontal</MenuItem>
                      <MenuItem value="4:5">4:5 Portrait</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" disabled={imageGenLoading}>
                    <InputLabel>Format</InputLabel>
                    <Select
                      value={outputFormat}
                      label="Format"
                      onChange={e => setOutputFormat(e.target.value)}
                      sx={{ minWidth: 100, borderRadius: 2 }}
                    >
                      <MenuItem value="JPG">JPG</MenuItem>
                      <MenuItem value="PNG">PNG</MenuItem>
                    </Select>
                  </FormControl>

                  <Box sx={{
                    height: 40, px: 1.5, display: 'flex', alignItems: 'center', gap: 0.75,
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2,
                    color: 'text.disabled', fontSize: '0.8125rem',
                    bgcolor: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap',
                  }}>
                    <Lock size={13} /> 1K Resolution
                  </Box>
                </Box>

                {/* Right: generate button */}
                <Button
                  variant="contained"
                  onClick={handleGenerateImages}
                  disabled={imageGenLoading || concept?.status === 'rejected'}
                  startIcon={imageGenLoading ? <CircularProgress size={16} /> : <Zap size={16} />}
                  sx={{ borderRadius: '16px', whiteSpace: 'nowrap' }}
                >
                  {imageGenLoading ? 'Generating image… (~30s)' : 'Generate with this prompt'}
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ borderRadius: 3, overflow: 'hidden', maxWidth: 480, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img
                    src={generatedImages[0].image_url}
                    alt="Generated concept image"
                    style={{ width: '100%', display: 'block' }}
                  />
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Check size={12} color="#22c55e" /> Image generated — one image per concept
                </Typography>
              </Box>
            )}
          </Box>

          {/* Video Generation Section — shown when images exist */}
          {generatedImages.length > 0 && (
            <Box sx={{ mb: 6 }}>
              <Divider sx={{ mb: 4 }} />
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Video size={18} color="#8b5cf6" /> Video Generation
                <Chip label="FAL.AI" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontSize: '0.65rem', ml: 1 }} />
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generate a 5-second video from the concept image above.
              </Typography>

              {videoGenError && <Alert severity="error" sx={{ mb: 2 }}>{videoGenError}</Alert>}

              <Button
                variant="outlined"
                onClick={handleGenerateVideo}
                disabled={videoGenLoading || !selectedImageForVideo}
                startIcon={videoGenLoading ? <CircularProgress size={16} /> : <Video size={16} />}
                sx={{ borderRadius: '16px', borderColor: '#8b5cf6', color: '#8b5cf6', mb: 3 }}
              >
                {videoGenLoading ? 'Generating video… (~2 min)' : 'Generate video from selected image'}
              </Button>

              {videoUrl && (
                <Box sx={{ borderRadius: 2, overflow: 'hidden', maxWidth: 360 }}>
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    style={{ width: '100%', display: 'block', borderRadius: 8 }}
                  />
                  <Button
                    href={videoUrl}
                    target="_blank"
                    variant="text"
                    size="small"
                    sx={{ mt: 1, color: 'text.secondary' }}
                  >
                    Open video in new tab ↗
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Container>
      </Box>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Delete this concept?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This will permanently delete the concept and all generated images. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ borderRadius: '16px', color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteLoading}
            sx={{ borderRadius: '16px' }}
          >
            {deleteLoading ? 'Deleting…' : 'Yes, delete it'}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

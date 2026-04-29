"use client";

import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, Chip, Alert, CircularProgress,
  Divider, TextField, Card, CardMedia, Grid, IconButton, Tooltip,
  CssBaseline, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faXmark, faPenToSquare, faImage,
  faVideo, faWandMagicSparkles, faSpinner, faChartBar, faTrash
} from '@fortawesome/free-solid-svg-icons';
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

  // Video gen
  const [videoGenLoading, setVideoGenLoading] = useState(false);
  const [videoGenError, setVideoGenError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedImageForVideo, setSelectedImageForVideo] = useState('');

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      const res = await fetch(`/api/concepts/${id}/generate-image`, { method: 'POST' });
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
            <FontAwesomeIcon icon={faArrowLeft} />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#3B82F6' }} /> JamBox
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
              startIcon={<FontAwesomeIcon icon={faCheck} />}
              onClick={() => handleAction('approve')}
              disabled={!!actionLoading || !isPending}
              sx={{ borderRadius: 20 }}
            >
              {actionLoading === 'approve' ? 'Approving…' : 'YES — Approve'}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<FontAwesomeIcon icon={faXmark} />}
              onClick={() => handleAction('reject')}
              disabled={!!actionLoading || !isPending}
              sx={{ borderRadius: 20 }}
            >
              {actionLoading === 'reject' ? 'Declining…' : 'NO — Decline'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faPenToSquare} />}
              onClick={() => setEditMode(!editMode)}
              disabled={!!actionLoading}
              sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Edit & Approve
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="outlined"
              color="error"
              startIcon={<FontAwesomeIcon icon={faTrash} />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ borderRadius: 20, borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
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
                  sx={{ borderRadius: 20 }}
                >
                  {actionLoading === 'edit' ? 'Saving…' : 'Confirm Approval with Edits'}
                </Button>
                <Button onClick={() => setEditMode(false)} sx={{ borderRadius: 20, color: 'text.secondary' }}>
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
                <Typography variant="overline" color="primary" sx={{ letterSpacing: 2, fontWeight: 700 }}>
                  📝 COPY
                </Typography>
                <Typography variant="body1" sx={{ mt: 1.5, p: 2.5, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                  {concept?.edited_copy || concept?.copy}
                </Typography>
                {concept?.edited_copy && concept.edited_copy !== concept.copy && (
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    ✏️ Edited from original
                  </Typography>
                )}
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="overline" color="secondary" sx={{ letterSpacing: 2, fontWeight: 700 }}>
                  🎨 VISUAL DIRECTION
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                  {concept?.visual_direction}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: '#f59e0b' }}>
                  💡 WHY THIS WORKS
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
                  <FontAwesomeIcon icon={faChartBar} /> SPROUT AI DATA BACKING NOTES
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
              <FontAwesomeIcon icon={faImage} style={{ color: '#3B82F6' }} /> Image Generation
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
              <Button
                variant="contained"
                onClick={handleGenerateImages}
                disabled={imageGenLoading || concept?.status === 'rejected'}
                startIcon={imageGenLoading
                  ? <FontAwesomeIcon icon={faSpinner} spin />
                  : <FontAwesomeIcon icon={faWandMagicSparkles} />
                }
                sx={{ borderRadius: 20, mb: 3 }}
              >
                {imageGenLoading ? 'Generating image… (~30s)' : 'Generate with this prompt'}
              </Button>
            ) : (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ borderRadius: 3, overflow: 'hidden', maxWidth: 480, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img
                    src={generatedImages[0].image_url}
                    alt="Generated concept image"
                    style={{ width: '100%', display: 'block' }}
                  />
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                  ✅ Image generated — one image per concept
                </Typography>
              </Box>
            )}
          </Box>

          {/* Video Generation Section — shown when images exist */}
          {generatedImages.length > 0 && (
            <Box sx={{ mb: 6 }}>
              <Divider sx={{ mb: 4 }} />
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FontAwesomeIcon icon={faVideo} style={{ color: '#8b5cf6' }} /> Video Generation
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
                startIcon={videoGenLoading
                  ? <FontAwesomeIcon icon={faSpinner} spin />
                  : <FontAwesomeIcon icon={faVideo} />
                }
                sx={{ borderRadius: 20, borderColor: '#8b5cf6', color: '#8b5cf6', mb: 3 }}
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
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ borderRadius: 20, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteLoading}
            sx={{ borderRadius: 20 }}
          >
            {deleteLoading ? 'Deleting…' : 'Yes, delete it'}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

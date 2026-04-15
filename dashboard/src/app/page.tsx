"use client";

import React, { useState, useEffect } from 'react';
import { 
  AppBar, Toolbar, Typography, Container, Grid, Card, CardContent, 
  CardMedia, CardActions, Button, Chip, Drawer, Box, CssBaseline, Skeleton, Fade
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSliders, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import VariablesPanel from '../components/VariablesPanel';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0A0A0A',
      paper: '#141414',
    },
    primary: { main: '#3B82F6' }, // bright blue,
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
    }
  }
});

export default function DashboardHome() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchConcepts() {
      try {
        const res = await fetch('/api/concepts');
        const data = await res.json();
        
        if (data.concepts) {
          // Normalize Supabase structure to match Dashboard UI variables
          const formatted = data.concepts.map((c: any) => ({
            id: c.id,
            platform: c.platform || "Unknown",
            status: c.status === "approved" ? "Approved" : c.status === "rejected" ? "Rejected" : "Pending",
            copy: c.copy || "",
            assignedTo: "@automations", // Stub until auth is built
            reason: c.status === "rejected" ? c.rationale : null,
            images: c.generated_images ? c.generated_images.map((img: any) => img.url) : []
          }));
          setConcepts(formatted);
        }
      } catch (err) {
        console.error("Error fetching live concepts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchConcepts();
  }, []);

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
             <Button variant="outlined" sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', px: 2, py: 0.5 }}>
               Brand: Fuzzy's <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65em', marginLeft: '8px', opacity: 0.7 }} />
             </Button>
             <Button variant="outlined" sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', px: 2, py: 0.5 }}>
               Apr 2026 <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65em', marginLeft: '8px', opacity: 0.7 }} />
             </Button>
             <Button variant="outlined" onClick={() => setDrawerOpen(!drawerOpen)} sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', px: 2, py: 0.5 }}>
               <FontAwesomeIcon icon={faSliders} style={{ marginRight: '8px', color: '#3B82F6' }} /> Variables
             </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>
            Today's Concepts — Apr 15
          </Typography>
          
          {loading ? (
            <Fade in={loading} timeout={500}>
              <Grid container spacing={4}>
                {[1, 2, 3].map((item) => (
                  <Grid item xs={12} md={4} key={item}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 0 }}>
                      <Skeleton variant="rectangular" height={200} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Skeleton variant="text" width={80} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                          <Skeleton variant="rounded" width={60} height={24} sx={{ borderRadius: 12, bgcolor: 'rgba(255,255,255,0.05)' }} />
                        </Box>
                        <Skeleton variant="text" width="100%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <Skeleton variant="text" width="60%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                      </CardContent>
                      <CardActions sx={{ pb: 2, px: 2 }}>
                        <Skeleton variant="rounded" width={100} height={28} sx={{ borderRadius: 12, bgcolor: 'rgba(255,255,255,0.05)' }} />
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Fade>
          ) : (
            <Fade in={!loading} timeout={800}>
              <Grid container spacing={4}>
                {concepts.map((concept) => (
                  <Grid item xs={12} md={4} key={concept.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {concept.images.length > 0 && (
                        <CardMedia
                          component="img"
                          height="200"
                          image={concept.images[0]}
                          alt="Concept idea"
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            {concept.platform}
                          </Typography>
                          <Chip 
                            label={concept.status} 
                            size="small" 
                            color={concept.status === 'Approved' ? 'success' : 'error'} 
                          />
                        </Box>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                          "{concept.copy}"
                        </Typography>
                        {concept.reason && (
                          <Box sx={{ mt: 1, backgroundColor: 'rgba(211, 47, 47, 0.15)', color: '#ef5350', border: '1px solid rgba(211, 47, 47, 0.3)', px: 1.5, py: 0.5, borderRadius: 0, display: 'inline-block' }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                              Reason: {concept.reason}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                      <CardActions sx={{ pb: 2, px: 2 }}>
                        <Box sx={{ backgroundColor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 12, px: 1.5, py: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                            Assigned: {concept.assignedTo || 'Unassigned'}
                          </Typography>
                        </Box>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
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
        <VariablesPanel onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </Box>
    </ThemeProvider>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import {
  Typography, Box, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
  TextField, Button, Chip, Divider, Slider, Alert, CircularProgress
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

export default function VariablesPanel({ onClose, activeBrandId = "fuzzys_taco_shop" }: { onClose: () => void, activeBrandId?: string }) {
  const router = useRouter();
  const [tone, setTone] = useState("witty");
  const [creativity, setCreativity] = useState(0.8);
  const [trendWeight, setTrendWeight] = useState(0.6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => {
        if (data.brands) {
          const brand = data.brands.find((b: any) => b.brand_id === activeBrandId);
          if (brand?.creative_variables) {
            const v = brand.creative_variables;
            if (v.tone) setTone(v.tone);
            if (v.creativity !== undefined) setCreativity(v.creativity);
            if (v.trend_weight !== undefined) setTrendWeight(v.trend_weight);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeBrandId]);

  const handleSave = async (runNow: boolean) => {
    setSaving(true);
    setStatusMsg("Saving variables...");
    try {
      const saveRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: activeBrandId,
          creative_variables: { tone, creativity, trend_weight: trendWeight }
        })
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setStatusMsg(`❌ Save failed: ${saveData.error || 'Unknown error'}`);
        setSaving(false);
        return;
      }
      setStatusMsg("✅ Variables saved!");
      setSaving(false);

      if (runNow) {
        setGenerating(true);
        setStatusMsg("🚀 Generating concepts via Gemini… (~30s)");
        const genRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_id: activeBrandId })
        });
        const genData = await genRes.json();
        setGenerating(false);
        if (!genRes.ok) {
          setStatusMsg(`❌ Generation failed: ${genData.error || 'Unknown error'}`);
          return;
        }
        const resultSummary = (genData.results || []).join(' · ');
        setStatusMsg(`✅ Done! ${resultSummary}`);
        setTimeout(() => onClose(), 2500);
        return;
      }

      onClose();
    } catch (err: any) {
      setStatusMsg(`❌ Error: ${err.message}`);
      setSaving(false);
      setGenerating(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <FontAwesomeIcon icon={faSliders} style={{ color: '#3B82F6' }} /> Variables
        <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', fontWeight: 400 }}>
          {activeBrandId}
        </Typography>
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>

          {/* Tone */}
          <Box>
            <FormLabel component="legend" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1 }}>Tone</FormLabel>
            <RadioGroup row value={tone} onChange={(e) => setTone(e.target.value)}>
              <FormControlLabel value="playful" control={<Radio size="small" />} label="Playful" />
              <FormControlLabel value="witty" control={<Radio size="small" />} label="Witty" />
              <FormControlLabel value="bold" control={<Radio size="small" />} label="Bold" />
            </RadioGroup>
          </Box>

          <Divider />

          {/* Creativity */}
          <Box>
            <Typography variant="body2" gutterBottom color="text.secondary">
              Creativity — {creativity <= 0.3 ? 'Conservative' : creativity >= 0.8 ? 'Wild' : 'Balanced'}
            </Typography>
            <Slider
              value={creativity}
              onChange={(_, v) => setCreativity(v as number)}
              min={0.1} max={1.0} step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={v => Math.round(v * 10)}
            />
          </Box>

          {/* Trend Weight */}
          <Box>
            <Typography variant="body2" gutterBottom color="text.secondary">
              Trend Weight — {trendWeight <= 0.3 ? 'Evergreen' : trendWeight >= 0.8 ? 'Trendy' : 'Mixed'}
            </Typography>
            <Slider
              value={trendWeight}
              onChange={(_, v) => setTrendWeight(v as number)}
              min={0.1} max={1.0} step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={v => Math.round(v * 10)}
            />
          </Box>

          <Divider />

          {/* See All Variables */}
          <Button
            variant="outlined"
            fullWidth
            endIcon={<FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: '0.8em' }} />}
            onClick={() => { onClose(); router.push('/variables'); }}
            sx={{ borderRadius: 20, borderColor: 'rgba(255,255,255,0.15)', color: 'white', justifyContent: 'space-between', px: 2.5 }}
          >
            See All Variables
          </Button>

          {statusMsg && (
            <Alert severity={statusMsg.startsWith('❌') ? 'error' : statusMsg.startsWith('✅') ? 'success' : 'info'} sx={{ fontSize: '0.85rem' }}>
              {statusMsg}
            </Alert>
          )}

          <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSave(true)}
              disabled={saving || generating}
              fullWidth
              sx={{ borderRadius: 20 }}
            >
              {generating ? '🚀 Generating…' : 'Save & Generate Now'}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => handleSave(false)}
              disabled={saving || generating}
              fullWidth
              sx={{ borderRadius: 20 }}
            >
              Save for Tomorrow
            </Button>
            <Button onClick={onClose} color="inherit" disabled={saving || generating} fullWidth>
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

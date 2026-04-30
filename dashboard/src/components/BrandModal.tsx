"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Divider,
  FormLabel, RadioGroup, FormControlLabel, Radio,
  Slider, Alert, CircularProgress, Avatar, IconButton,
} from '@mui/material';
import { Upload, X } from 'react-feather';

interface Brand {
  brand_id: string;
  brand_name: string;
  logo_url?: string;
  config?: Record<string, any>;
  creative_variables?: Record<string, any>;
}

interface BrandModalProps {
  open: boolean;
  brand: Brand | null; // null = create mode
  onClose: () => void;
  onSaved: (brand: Brand) => void;
}

export default function BrandModal({ open, brand, onClose, onSaved }: BrandModalProps) {
  const isEdit = !!brand;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('');
  const [channelId, setChannelId] = useState('');
  const [tone, setTone] = useState('witty');
  const [creativity, setCreativity] = useState(0.7);
  const [trendWeight, setTrendWeight] = useState(0.6);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setBrandName(brand?.brand_name || '');
      setIndustry(brand?.config?.industry || '');
      setChannelId(brand?.config?.channel_id || '');
      setTone(brand?.creative_variables?.tone || 'witty');
      setCreativity(brand?.creative_variables?.creativity ?? 0.7);
      setTrendWeight(brand?.creative_variables?.trend_weight ?? 0.6);
      setLogoFile(null);
      setLogoPreview(brand?.logo_url || '');
      setError('');
    }
  }, [open, brand]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!brandName.trim()) { setError('Brand name is required'); return; }
    setSaving(true);
    setError('');

    try {
      let logo_url = brand?.logo_url || undefined;

      // Upload logo if a new file was selected
      if (logoFile) {
        const tempId = isEdit ? brand!.brand_id : brandName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
        const fd = new FormData();
        fd.append('file', logoFile);
        fd.append('brand_id', tempId);
        const uploadRes = await fetch('/api/brands/logo', { method: 'POST', body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Logo upload failed');
        logo_url = uploadData.url;
      }

      const body = isEdit
        ? {
            brand_id: brand!.brand_id,
            brand_name: brandName,
            config: { industry, channel_id: channelId },
            creative_variables: { tone, creativity, trend_weight: trendWeight },
            logo_url,
          }
        : {
            action: 'create',
            brand_name: brandName,
            config: { industry, channel_id: channelId },
            creative_variables: { tone, creativity, trend_weight: trendWeight },
            logo_url,
          };

      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      onSaved(data.brand);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#1c1c1d', border: '1px solid #363639', borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight="bold">{isEdit ? 'Edit Brand' : 'New Brand'}</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={logoPreview}
            sx={{ width: 64, height: 64, bgcolor: '#2f2f30', cursor: 'pointer', border: '1px solid #363639', fontSize: '1.5rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            {!logoPreview && brandName.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderColor: '#363639', color: 'white', borderRadius: '10px' }}
            >
              {logoPreview ? 'Change logo' : 'Upload logo'}
            </Button>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
              PNG, JPG or SVG — recommended 200×200px
            </Typography>
          </Box>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
        </Box>

        <Divider sx={{ borderColor: '#363639' }} />

        {/* Identity */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Brand Name"
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            fullWidth
            size="small"
            required
            disabled={isEdit}
            helperText={isEdit ? `ID: ${brand?.brand_id}` : 'Auto-generates a brand ID from the name'}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Industry"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              fullWidth
              size="small"
              placeholder="food, fashion, tech…"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <TextField
              label="Slack Channel ID"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              fullWidth
              size="small"
              placeholder="C012345678"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </Box>
        </Box>

        <Divider sx={{ borderColor: '#363639' }} />

        {/* Creative Foundation */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.75rem' }}>
            Creative Foundation
          </Typography>

          <Box>
            <FormLabel sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Tone</FormLabel>
            <RadioGroup row value={tone} onChange={e => setTone(e.target.value)} sx={{ mt: 0.5 }}>
              {['playful', 'witty', 'bold', 'authentic', 'premium', 'rebellious'].map(t => (
                <FormControlLabel key={t} value={t} control={<Radio size="small" />} label={t.charAt(0).toUpperCase() + t.slice(1)} />
              ))}
            </RadioGroup>
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Creativity — {creativity <= 0.3 ? 'Conservative' : creativity >= 0.8 ? 'Wild' : 'Balanced'}
            </Typography>
            <Slider value={creativity} onChange={(_, v) => setCreativity(v as number)} min={0.1} max={1.0} step={0.1} valueLabelDisplay="auto" valueLabelFormat={v => Math.round(v * 10)} />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Trend Weight — {trendWeight <= 0.3 ? 'Evergreen' : trendWeight >= 0.8 ? 'Trendy' : 'Mixed'}
            </Typography>
            <Slider value={trendWeight} onChange={(_, v) => setTrendWeight(v as number)} min={0.1} max={1.0} step={0.1} valueLabelDisplay="auto" valueLabelFormat={v => Math.round(v * 10)} />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: '10px' }} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ borderRadius: '10px', paddingTop: '11px', paddingBottom: '12px', minWidth: 120 }}
        >
          {saving ? <CircularProgress size={16} color="inherit" /> : isEdit ? 'Save Changes' : 'Create Brand'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

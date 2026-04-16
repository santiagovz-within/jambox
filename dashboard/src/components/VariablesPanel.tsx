"use client";

import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, 
  TextField, Button, Chip, Divider, Slider, Alert, CircularProgress
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders } from '@fortawesome/free-solid-svg-icons';

export default function VariablesPanel({ onClose, activeBrandId = "fuzzys_taco_shop" }: { onClose: () => void, activeBrandId?: string }) {
  const [tone, setTone] = useState("witty");
  const [pushTopic, setPushTopic] = useState("");
  const [pushList, setPushList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [insight, setInsight] = useState("Analyzing recent feedback logs... ⏳");

  useEffect(() => {
    // 1. Fetch Variables
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => {
        if (data.brands) {
           const brandProfile = data.brands.find((b: any) => b.brand_id === activeBrandId);
           if (brandProfile && brandProfile.creative_variables) {
               if (brandProfile.creative_variables.tone) setTone(brandProfile.creative_variables.tone);
               if (brandProfile.creative_variables.push_topics) setPushList(brandProfile.creative_variables.push_topics);
           }
        }
        setLoading(false);
      });

    // 2. Fetch AI Insights
    fetch(`/api/insights?brand_id=${activeBrandId}`)
      .then(res => res.json())
      .then(data => {
         if (data.insight) setInsight(data.insight);
      });
  }, [activeBrandId]);

  const [statusMsg, setStatusMsg] = useState("");

  const handleSave = async (runNow: boolean) => {
    setSaving(true);
    setStatusMsg("Saving variables...");
    try {
      const saveRes = await fetch('/api/brands', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            brand_id: activeBrandId,
            creative_variables: {
               tone: tone,
               push_topics: pushList
            }
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
        setStatusMsg("🚀 Generating concepts via Gemini... (this takes ~30s)");
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
        setStatusMsg(`✅ Done! ${JSON.stringify(genData.results || [])}`);
        // Auto-close after 2 seconds so user can see the success message
        setTimeout(() => onClose(), 2000);
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
        <FontAwesomeIcon icon={faSliders} style={{ color: '#3B82F6' }} /> Creative Variables
      </Typography>

      {loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}><CircularProgress /></Box>
      ) : (
      <Box sx={{ display: 'contents' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold">Creative Direction ({activeBrandId})</Typography>
          <FormLabel component="legend" sx={{ mt: 2 }}>Tone</FormLabel>
          <RadioGroup row value={tone} onChange={(e) => setTone(e.target.value)}>
          <FormControlLabel value="playful" control={<Radio size="small" />} label="Playful" />
          <FormControlLabel value="witty" control={<Radio size="small" />} label="Witty" />
          <FormControlLabel value="bold" control={<Radio size="small" />} label="Bold" />
        </RadioGroup>

        <Box sx={{ mt: 2 }}>
          <FormLabel component="legend">Topics to Push</FormLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {pushList.map(item => (
              <Chip key={item} label={item} onDelete={() => setPushList(pushList.filter(i => i !== item))} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', mt: 1 }}>
            <TextField 
              size="small" 
              placeholder="Add topic" 
              value={pushTopic} 
              onChange={(e) => setPushTopic(e.target.value)} 
              sx={{ flexGrow: 1 }}
            />
            <Button onClick={() => { if(pushTopic) { setPushList([...pushList, pushTopic]); setPushTopic(""); } }}>Add</Button>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Generation Tuning</Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Concepts per day (5)</Typography>
          <Slider defaultValue={5} min={1} max={10} marks valueLabelDisplay="auto" />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Creativity (conservative ↔ wild)</Typography>
          <Slider defaultValue={0.8} min={0.1} max={1.0} step={0.1} valueLabelDisplay="auto" />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Trend weight (evergreen ↔ trendy)</Typography>
          <Slider defaultValue={0.6} min={0.1} max={1.0} step={0.1} valueLabelDisplay="auto" />
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>AI Learning Insights</Typography>
        <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
          {insight}
        </Alert>
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Insights are computed by analyzing your team's historical Slack Slack approvals/rejections against the brand identity.
          </Typography>
        </Box>
      </Box>

      {statusMsg && (
        <Alert severity={statusMsg.startsWith('❌') ? 'error' : statusMsg.startsWith('✅') ? 'success' : 'info'} sx={{ fontSize: '0.85rem', mb: 1 }}>
          {statusMsg}
        </Alert>
      )}

      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
        <Button variant="contained" color="primary" onClick={() => handleSave(true)} disabled={saving || generating} fullWidth>
           {generating ? "🚀 Generating..." : "Save & Generate Now"}
        </Button>
        <Button variant="outlined" color="primary" onClick={() => handleSave(false)} disabled={saving || generating} fullWidth>
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

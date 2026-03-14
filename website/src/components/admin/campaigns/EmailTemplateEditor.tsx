'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

const INTRO_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{margin:0;padding:0;background:#F4F4F4;font-family:Arial,sans-serif;}
.wrapper{max-width:600px;margin:0 auto;background:#fff;}
.header{background:linear-gradient(135deg,#00B8A9,#00d4c4);padding:28px 32px;text-align:center;}
.header h1{color:#fff;margin:0;font-size:22px;font-weight:700;}
.body{padding:32px;color:#333;font-size:15px;line-height:1.6;}
.body h2{color:#00B8A9;margin-top:0;}
.cta{display:block;width:fit-content;margin:24px auto;padding:14px 32px;background:#FF9800;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;}
.footer{background:#F9F9F9;padding:20px 32px;font-size:12px;color:#999;text-align:center;border-top:1px solid #EEE;}
.footer a{color:#00B8A9;text-decoration:none;}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>DriveDrop</h1></div>
  <div class="body">
    <h2>Hello {{companyName}} Team 👋</h2>
    <p>We're DriveDrop — a fast-growing vehicle transport marketplace connecting car dealers and fleet owners with reliable carriers like you.</p>
    <ul>
      <li><strong>Guaranteed payments</strong> — no more chasing invoices</li>
      <li><strong>No broker fees</strong> — you keep more of every haul</li>
      <li><strong>Real-time job matching</strong> in {{state}}</li>
    </ul>
    <p>Getting started is free and takes under 5 minutes.</p>
    <a href="https://drivedrop.app/carrier-signup?utm_source=email&utm_campaign={{campaignId}}" class="cta">Join as a Carrier</a>
  </div>
  <div class="footer">
    <p>DriveDrop · Charlotte, NC<br>
    <a href="{{unsubUrl}}">Unsubscribe</a></p>
  </div>
</div>
<img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none" alt="">
</body></html>`

const FOLLOWUP_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{margin:0;padding:0;background:#F4F4F4;font-family:Arial,sans-serif;}
.wrapper{max-width:600px;margin:0 auto;background:#fff;}
.header{background:linear-gradient(135deg,#00B8A9,#00d4c4);padding:28px 32px;text-align:center;}
.header h1{color:#fff;margin:0;font-size:22px;font-weight:700;}
.body{padding:32px;color:#333;font-size:15px;line-height:1.6;}
.body h2{color:#00B8A9;margin-top:0;}
.cta{display:block;width:fit-content;margin:24px auto;padding:14px 32px;background:#FF9800;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;}
.footer{background:#F9F9F9;padding:20px 32px;font-size:12px;color:#999;text-align:center;border-top:1px solid #EEE;}
.footer a{color:#00B8A9;text-decoration:none;}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>DriveDrop</h1></div>
  <div class="body">
    <h2>Quick question about {{companyName}}'s load board needs</h2>
    <p>We reached out recently about DriveDrop — just following up in case the timing wasn't right.</p>
    <p>We currently have <strong>active shipments in {{state}}</strong> looking for qualified carriers including dealer trades, private relocations, and fleet contracts.</p>
    <a href="https://drivedrop.app/carrier-signup?utm_source=email&utm_campaign={{campaignId}}" class="cta">View Available Loads</a>
    <p style="font-size:13px;color:#888;">This is our last follow-up. We won't bother you again if this isn't a fit.</p>
  </div>
  <div class="footer">
    <p>DriveDrop · Charlotte, NC<br>
    <a href="{{unsubUrl}}">Unsubscribe</a></p>
  </div>
</div>
<img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none" alt="">
</body></html>`

const OFFER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{margin:0;padding:0;background:#F4F4F4;font-family:Arial,sans-serif;}
.wrapper{max-width:600px;margin:0 auto;background:#fff;}
.header{background:linear-gradient(135deg,#00B8A9,#00d4c4);padding:28px 32px;text-align:center;}
.header h1{color:#fff;margin:0;font-size:22px;font-weight:700;}
.body{padding:32px;color:#333;font-size:15px;line-height:1.6;}
.body h2{color:#00B8A9;margin-top:0;}
.offer-box{background:#FFF8E1;border:2px solid #FF9800;border-radius:8px;padding:16px;margin:20px 0;text-align:center;}
.offer-box p{margin:0;font-size:18px;font-weight:bold;color:#E65100;}
.cta{display:block;width:fit-content;margin:24px auto;padding:14px 32px;background:#FF9800;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;}
.footer{background:#F9F9F9;padding:20px 32px;font-size:12px;color:#999;text-align:center;border-top:1px solid #EEE;}
.footer a{color:#00B8A9;text-decoration:none;}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>DriveDrop</h1></div>
  <div class="body">
    <h2>Exclusive offer for {{state}} carriers 🎉</h2>
    <div class="offer-box"><p>90 Days — 0% Platform Fees</p></div>
    <p>Join DriveDrop before this offer expires and pay zero transaction fees for your first 90 days.</p>
    <ul>
      <li>✅ Instant payment on delivery</li>
      <li>✅ Priority load matching in {{state}}</li>
      <li>✅ Digital BOL & inspection reports</li>
    </ul>
    <a href="https://drivedrop.app/carrier-signup?utm_source=email&utm_campaign={{campaignId}}&promo=carrier90" class="cta">Claim Offer Now</a>
  </div>
  <div class="footer">
    <p>DriveDrop · Charlotte, NC<br>
    <a href="{{unsubUrl}}">Unsubscribe</a></p>
  </div>
</div>
<img src="{{trackingPixelUrl}}" width="1" height="1" style="display:none" alt="">
</body></html>`

const TEMPLATES = [
  { id: 'introduction', label: 'Introduction Email', html: INTRO_TEMPLATE, subject: 'Streamline Your Auto Transport Loads with DriveDrop' },
  { id: 'followUp', label: 'Follow-Up Email', html: FOLLOWUP_TEMPLATE, subject: "Quick question about {{companyName}}'s load board needs" },
  { id: 'specialOffer', label: 'Special Offer Email', html: OFFER_TEMPLATE, subject: 'Exclusive offer for {{state}} carriers' },
]

interface EmailTemplateEditorProps {
  value: string
  onChange: (html: string) => void
}

export default function EmailTemplateEditor({ value, onChange }: EmailTemplateEditorProps) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [selectedTemplate, setSelectedTemplate] = useState('')

  function applyTemplate(templateId: string) {
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (tpl) {
      onChange(tpl.html)
      setSelectedTemplate(templateId)
    }
  }

  return (
    <div className="space-y-3">
      {/* Template picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Load Pre-Built Template</label>
        <div className="relative">
          <select
            value={selectedTemplate}
            onChange={e => applyTemplate(e.target.value)}
            className="w-full md:w-72 appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] bg-white"
          >
            <option value="">Choose a template...</option>
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Variables hint */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">Available Variables</p>
          <div className="flex flex-wrap gap-1">
            {['{{companyName}}', '{{city}}', '{{state}}', '{{unsubUrl}}', '{{trackingPixelUrl}}', '{{campaignId}}'].map(v => (
              <code key={v} className="text-xs bg-white border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded">{v}</code>
            ))}
          </div>
        </div>
      </div>

      {/* Edit / Preview tabs */}
      <div>
        <div className="flex border-b border-gray-200 mb-3">
          <button type="button" onClick={() => setTab('edit')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'edit' ? 'border-[#00B8A9] text-[#00B8A9]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Edit HTML
          </button>
          <button type="button" onClick={() => setTab('preview')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'preview' ? 'border-[#00B8A9] text-[#00B8A9]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Preview
          </button>
        </div>
        {tab === 'edit' ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Paste HTML or load a template above..."
            rows={16}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
          />
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50" style={{ height: '400px' }}>
            {value ? (
              <iframe
                srcDoc={value.replace(/\{\{.+?\}\}/g, m => `<span style="background:#fef9c3;padding:0 2px">${m}</span>`)}
                className="w-full h-full border-0"
                title="Email preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No content — select a template or write HTML
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

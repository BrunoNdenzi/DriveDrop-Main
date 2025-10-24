# Input Placeholder Text Visibility Fix

## Issue
Card payment input fields had placeholder text that was too light and nearly invisible to users, making it difficult to see what information should be entered in each field.

## Root Cause
The `Input` component was using `Colors.text.disabled` (`#9FAAB5` - light gray) for the placeholder text color. This color is:
- Too light for comfortable viewing
- Insufficient contrast against white/light backgrounds
- Not accessible for users with visual impairments

## Solution
Changed the placeholder text color from `Colors.text.disabled` to `Colors.text.secondary`:

### Before:
```typescript
placeholderTextColor={Colors.text.disabled}  // #9FAAB5 (gray[400])
```

### After:
```typescript
placeholderTextColor={Colors.text.secondary}  // #475467 (gray[600])
```

## Color Reference
- **Old**: `NeutralColors.gray[400]` = `#9FAAB5` (too light)
- **New**: `NeutralColors.gray[600]` = `#475467` (darker, more visible)

This change provides better contrast while still clearly distinguishing placeholders from actual input text (which uses `Colors.text.primary` = `#101828`).

## Impact
This fix affects **all input fields** throughout the app, including:
- Payment card details (card number, CVV, expiry date)
- Billing address fields
- All other form inputs using the `Input` component

## Files Modified
- `mobile/src/components/ui/Input.tsx`

## Benefits
✅ Better visibility of placeholder text  
✅ Improved user experience during form filling  
✅ Better accessibility compliance  
✅ Clearer guidance for users on what to enter  
✅ Consistent with WCAG contrast guidelines

## Testing
Test the following screens to verify improved placeholder visibility:
1. Payment screen (card details)
2. Sign up form
3. Profile edit screens
4. Any other forms with text inputs

All placeholder text should now be clearly visible against the background.

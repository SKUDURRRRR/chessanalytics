# Mobile QA Checklist

## Pre-Testing Setup
- [ ] Test on actual devices (iPhone 12/13/14, Android Pixel/Samsung)
- [ ] Test on different screen sizes (360px, 375px, 414px, 768px)
- [ ] Test in both portrait and landscape orientations
- [ ] Test with different network conditions (3G, 4G, WiFi)
- [ ] Test with different accessibility settings

## Core Functionality Tests

### Navigation
- [ ] Mobile navigation bar appears on screens < 768px
- [ ] Navigation items are touch-friendly (44px minimum)
- [ ] Navigation works with keyboard navigation
- [ ] Back button works correctly
- [ ] Tab switching works smoothly

### Chessboard & Game Analysis
- [ ] Chessboard scales properly on mobile screens
- [ ] Board fits within viewport without horizontal scroll
- [ ] Touch interactions work (tap to select moves)
- [ ] Move navigation buttons are accessible
- [ ] Board notation is readable on small screens
- [ ] Arrows and highlights are visible

### Data Views
- [ ] Tables convert to card layouts on mobile
- [ ] Cards are touch-friendly and readable
- [ ] Horizontal scroll works for wide content
- [ ] Data is not truncated unnecessarily
- [ ] Charts and graphs are mobile-optimized

### Forms & Interactions
- [ ] Input fields are properly sized for mobile
- [ ] Keyboard doesn't obscure form fields
- [ ] Touch targets meet 44px minimum
- [ ] Action menus use bottom sheets on mobile
- [ ] Modals are mobile-friendly

## Performance Tests

### Loading Performance
- [ ] Initial page load < 3 seconds on 3G
- [ ] Time to Interactive < 5 seconds
- [ ] First Contentful Paint < 2 seconds
- [ ] No layout shift > 0.1 CLS

### Runtime Performance
- [ ] Smooth scrolling (60fps)
- [ ] No jank during interactions
- [ ] Memory usage stays reasonable
- [ ] No memory leaks during navigation

### Bundle Size
- [ ] Initial bundle < 500KB gzipped
- [ ] Critical path < 200KB
- [ ] Lazy loading works for non-critical components

## Accessibility Tests

### Visual
- [ ] Text is readable without zooming
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible
- [ ] No content is cut off

### Interaction
- [ ] All interactive elements are keyboard accessible
- [ ] Touch targets are large enough
- [ ] Gestures work as expected
- [ ] VoiceOver/TalkBack work correctly

### Content
- [ ] Alt text for images
- [ ] Proper heading hierarchy
- [ ] Screen reader announcements work
- [ ] ARIA labels are present where needed

## Device-Specific Tests

### iOS Safari
- [ ] No horizontal scroll issues
- [ ] Safe area insets work correctly
- [ ] Touch events work properly
- [ ] No zoom issues on form focus
- [ ] Status bar doesn't interfere

### Android Chrome
- [ ] Material Design guidelines followed
- [ ] Back button behavior is correct
- [ ] No keyboard overlap issues
- [ ] Touch feedback works
- [ ] App-like experience

## Network & Performance

### Slow Networks
- [ ] App works on 3G (slow 3G simulation)
- [ ] Loading states are shown
- [ ] Offline behavior is handled
- [ ] Error states are user-friendly

### Battery Usage
- [ ] No excessive CPU usage
- [ ] Animations are optimized
- [ ] Background processes are minimal
- [ ] No memory leaks

## Edge Cases

### Orientation Changes
- [ ] Layout adapts to orientation change
- [ ] No content is lost during rotation
- [ ] Chessboard maintains aspect ratio
- [ ] Navigation remains accessible

### Low Memory
- [ ] App works on devices with < 2GB RAM
- [ ] Images are optimized
- [ ] Large datasets are handled efficiently
- [ ] No crashes due to memory pressure

### Different Input Methods
- [ ] Works with external keyboards
- [ ] Voice input works where applicable
- [ ] Stylus input works for precision
- [ ] Switch control works

## User Experience

### One-Handed Usage
- [ ] Important actions reachable with thumb
- [ ] Navigation doesn't require stretching
- [ ] Action buttons are in accessible areas
- [ ] Bottom navigation is used appropriately

### Error Handling
- [ ] Network errors are handled gracefully
- [ ] Form validation works on mobile
- [ ] Error messages are clear and actionable
- [ ] Recovery options are provided

### Content Readability
- [ ] Text is large enough to read comfortably
- [ ] Line spacing is appropriate
- [ ] Important information is prominent
- [ ] Secondary information is appropriately de-emphasized

## Testing Tools

### Automated Testing
- [ ] Playwright tests pass on mobile viewports
- [ ] Lighthouse mobile score > 80
- [ ] No console errors on mobile browsers
- [ ] Performance budgets are met

### Manual Testing
- [ ] Test with real users on actual devices
- [ ] Test with different skill levels
- [ ] Test with different use cases
- [ ] Gather feedback on mobile experience

## Deployment Checklist

### Pre-Deploy
- [ ] All mobile tests pass
- [ ] Performance budgets met
- [ ] Accessibility standards met
- [ ] Cross-browser compatibility verified

### Post-Deploy
- [ ] Monitor mobile performance metrics
- [ ] Track mobile user engagement
- [ ] Monitor crash reports
- [ ] Gather user feedback

## Success Criteria

### Performance
- [ ] Lighthouse mobile score ≥ 80
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 5s
- [ ] Cumulative Layout Shift < 0.1

### Usability
- [ ] No horizontal scrolling required
- [ ] All interactive elements are touch-friendly
- [ ] Navigation is intuitive on mobile
- [ ] Content is readable without zooming

### Accessibility
- [ ] WCAG AA compliance
- [ ] Screen reader compatibility
- [ ] Keyboard navigation works
- [ ] Color contrast meets standards

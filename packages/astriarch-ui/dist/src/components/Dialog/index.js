var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { styled } from '../../stitches.config';
import { Cross1Icon } from '@radix-ui/react-icons';
import * as DialogPrimitive from '@radix-ui/react-dialog';
const StyledOverlay = styled(DialogPrimitive.Overlay, {
// overlay styles
});
const StyledContent = styled(DialogPrimitive.Content, {
    backgroundColor: 'white',
    borderRadius: 6,
    boxShadow: 'hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px',
});
const StyledCloseButton = styled(DialogPrimitive.Close, {
// close button styles
});
export function Dialog(_a) {
    var { children } = _a, props = __rest(_a, ["children"]);
    return (_jsxs(DialogPrimitive.Root, Object.assign({}, props, { children: [_jsx(StyledOverlay, {}), children] })));
}
export const DialogContent = forwardRef((_a, forwardedRef) => {
    var { children } = _a, props = __rest(_a, ["children"]);
    return (_jsxs(StyledContent, Object.assign({}, props, { ref: forwardedRef }, { children: [children, _jsx(StyledCloseButton, { children: _jsx(Cross1Icon, {}) })] })));
});
export const DialogTrigger = DialogPrimitive.Trigger;

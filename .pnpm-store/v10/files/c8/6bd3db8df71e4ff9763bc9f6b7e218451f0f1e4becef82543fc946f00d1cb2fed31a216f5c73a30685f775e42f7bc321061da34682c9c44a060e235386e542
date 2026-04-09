import * as React from 'react';

interface PasswordToggleFieldProps {
    id?: string;
    visible?: boolean;
    defaultVisible?: boolean;
    onVisiblityChange?: (visible: boolean) => void;
    children?: React.ReactNode;
}
declare const PasswordToggleField: React.FC<PasswordToggleFieldProps>;
type PrimitiveInputProps = React.ComponentPropsWithoutRef<'input'>;
interface PasswordToggleFieldOwnProps {
    autoComplete?: 'current-password' | 'new-password';
}
interface PasswordToggleFieldInputProps extends PasswordToggleFieldOwnProps, Omit<PrimitiveInputProps, keyof PasswordToggleFieldOwnProps | 'type'> {
    autoComplete?: 'current-password' | 'new-password';
}
declare const PasswordToggleFieldInput: React.ForwardRefExoticComponent<PasswordToggleFieldInputProps & React.RefAttributes<HTMLInputElement>>;
type PrimitiveButtonProps = React.ComponentPropsWithoutRef<'button'>;
interface PasswordToggleFieldToggleProps extends Omit<PrimitiveButtonProps, 'type'> {
}
declare const PasswordToggleFieldToggle: React.ForwardRefExoticComponent<PasswordToggleFieldToggleProps & React.RefAttributes<HTMLButtonElement>>;
interface PasswordToggleFieldSlotDeclarativeProps {
    visible: React.ReactNode;
    hidden: React.ReactNode;
}
interface PasswordToggleFieldSlotRenderProps {
    render: (args: {
        visible: boolean;
    }) => React.ReactElement;
}
type PasswordToggleFieldSlotProps = PasswordToggleFieldSlotDeclarativeProps | PasswordToggleFieldSlotRenderProps;
declare const PasswordToggleFieldSlot: React.FC<PasswordToggleFieldSlotProps>;
type PrimitiveSvgProps = React.ComponentPropsWithoutRef<'svg'>;
interface PasswordToggleFieldIconProps extends Omit<PrimitiveSvgProps, 'children'> {
    visible: React.ReactElement;
    hidden: React.ReactElement;
}
declare const PasswordToggleFieldIcon: React.ForwardRefExoticComponent<PasswordToggleFieldIconProps & React.RefAttributes<SVGSVGElement>>;

export { PasswordToggleFieldIcon as Icon, PasswordToggleFieldInput as Input, PasswordToggleField, PasswordToggleFieldIcon, type PasswordToggleFieldIconProps, PasswordToggleFieldInput, type PasswordToggleFieldInputProps, type PasswordToggleFieldProps, PasswordToggleFieldSlot, type PasswordToggleFieldSlotProps, PasswordToggleFieldToggle, type PasswordToggleFieldToggleProps, PasswordToggleField as Root, PasswordToggleFieldSlot as Slot, PasswordToggleFieldToggle as Toggle };

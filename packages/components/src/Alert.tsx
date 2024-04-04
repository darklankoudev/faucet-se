import { twMerge } from "tailwind-merge";
import { tv, type VariantProps } from "tailwind-variants";

const alert = tv({
  slots: {
    base: "border border-current rounded-md text-base font-normal",
    title: "font-bold block uppercase text-sm mb-1",
  },
  variants: {
    type: {
      success: "",
      error: { base: "text-center text-red-500 px-4 py-4 mt-4" },
      warning: { base: "bg-neutral-800 border-yellow px-4 py-4" },
      info: {
        base: "text-center border-0 px-4 py-3",
        title: "text-yellow",
      },
    },
  },
});

type AlertBaseProps = VariantProps<typeof alert>;
type AlertProps = {
  title?: string;
  children: React.ReactNode;
  "data-testid"?: string;
} & AlertBaseProps &
  React.ComponentPropsWithoutRef<"div">;

export const Alert = ({
  title,
  children,
  "data-testid": dataTestId,
  ...props
}: AlertProps): JSX.Element => {
  const alertClass = alert({ type: props.type });
  return (
    <div
      data-testid={dataTestId}
      className={twMerge(alertClass.base(), props.className)}
      role="dialog"
      aria-labelledby={title}
    >
      {title && <strong className={alertClass.title()}>{title}</strong>}
      <div className="text-sm leading-[1.15em]">{children}</div>
    </div>
  );
};

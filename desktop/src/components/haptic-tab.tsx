export function HapticTab(props: any) {
  return (
    <button
      {...props}
      onMouseDown={(ev) => {
        props.onPressIn?.(ev);
      }}
    />
  );
}

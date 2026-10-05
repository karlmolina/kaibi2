import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';

type Props = { value: Date; onChange: (d: Date) => void };

export function DateTimeField({ value, onChange }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <View className="items-start">
        <DateTimePicker
          value={value}
          mode="datetime"
          themeVariant="dark"
          minuteInterval={5}
          onChange={(_, d) => d && onChange(d)}
        />
      </View>
    );
  }

  // Android has no combined picker: pick the date, then the time.
  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          onChange: (__, time) => time && onChange(time),
        });
      },
    });

  return (
    <Pressable onPress={open} className="rounded-xl bg-white/10 px-4 py-3 active:opacity-70">
      <Text className="text-base text-white">{value.toLocaleString()}</Text>
    </Pressable>
  );
}

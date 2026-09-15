import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerModal } from '@/components/DatePickerModal';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useCards } from '@/context/CardContext';
import { useCategories } from '@/context/CategoryContext';
import { useGoals } from '@/context/GoalContext';
import { useLimits } from '@/context/LimitContext';
import { useAuth } from '@/context/AuthContext';
import { useWallets } from '@/context/WalletContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useColors } from '@/hooks/useColors';
import { CATEGORY_COLORS } from '@/types/category';
import { LIMIT_PERIODS, type LimitPeriod } from '@/types/limit';
import { createLocalIsoDate, formatDateInput, getSaoPauloToday } from '@/utils/date';
import { formatAmountInput, parseAmountInput } from '@/utils/currency';

export type OnboardingStep = 'name' | 'profile' | 'wallet' | 'goal' | 'limit' | 'card';

interface OnboardingFlowProps {
  initialStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
  onComplete: () => void;
  onCancel: () => void;
}

const STEPS: OnboardingStep[] = ['name', 'profile', 'wallet', 'goal', 'limit', 'card'];

function getPreviousStep(step: OnboardingStep, initialStep: OnboardingStep): OnboardingStep | null {
  const currentIndex = STEPS.indexOf(step);
  const previousIndex = currentIndex - 1;
  const firstStepIndex = initialStep === 'wallet' ? STEPS.indexOf('wallet') : 0;
  return previousIndex >= firstStepIndex ? STEPS[previousIndex] : null;
}

function StepProgress({ step, colors }: { step: OnboardingStep; colors: ReturnType<typeof useColors> }) {
  const currentIndex = STEPS.indexOf(step);
  return (
    <View style={styles.progressRow} accessibilityLabel={`Etapa ${currentIndex + 1} de ${STEPS.length}`}>
      {STEPS.map((item, index) => (
        <View
          key={item}
          style={[
            styles.progressSegment,
            {
              backgroundColor: index <= currentIndex ? colors.primary : colors.border,
              opacity: index < currentIndex ? 0.48 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ChoiceButton({
  label,
  icon,
  onPress,
  colors,
  secondary = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        {
          backgroundColor: secondary ? colors.card : colors.primary,
          borderColor: secondary ? colors.border : colors.primary,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceButtonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>
        {label}
      </Text>
      <Feather name={icon} size={18} color={secondary ? colors.foreground : colors.primaryForeground} />
    </Pressable>
  );
}

function ContinueButton({
  label,
  onPress,
  colors,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.continueButton,
        { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.continueButtonText, { color: colors.primaryForeground }]}>{label}</Text>
      <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
    </Pressable>
  );
}

function SkipButton({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
      <Text style={[styles.skipButtonText, { color: colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function OnboardingFlow({ initialStep, onStepChange, onComplete, onCancel }: OnboardingFlowProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [error, setError] = useState('');
  const previousStep = getPreviousStep(step, initialStep);

  const goTo = (nextStep: OnboardingStep) => {
    setError('');
    setStep(nextStep);
    onStepChange(nextStep);
  };

  const finish = () => {
    setError('');
    onComplete();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
            <Feather name="bar-chart-2" size={21} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brandText, { color: colors.mutedForeground }]}>FINANÇAS MOBILE</Text>
        </View>
        <StepProgress step={step} colors={colors} />
        <View style={styles.navigationRow}>
          {previousStep ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar para a etapa anterior"
              testID="onboarding-back-button"
              onPress={() => goTo(previousStep)}
              style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
            >
              <Feather name="arrow-left" size={15} color={colors.mutedForeground} />
              <Text style={[styles.navigationText, { color: colors.mutedForeground }]}>Voltar</Text>
            </Pressable>
          ) : null}
          {step === initialStep ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar onboarding"
              testID="onboarding-cancel-button"
              onPress={onCancel}
              style={({ pressed }) => [styles.navigationButton, styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={[styles.navigationText, { color: colors.mutedForeground }]}>Cancelar onboarding</Text>
            </Pressable>
          ) : null}
        </View>

        {step === 'name' ? (
          <NameStep colors={colors} onContinue={() => goTo('profile')} setError={setError} error={error} />
        ) : null}
        {step === 'profile' ? (
          <BusinessProfileStep colors={colors} onContinue={() => goTo('wallet')} setError={setError} error={error} />
        ) : null}
        {step === 'wallet' ? (
          <WalletStep colors={colors} onContinue={() => goTo('goal')} setError={setError} error={error} />
        ) : null}
        {step === 'goal' ? (
          <GoalStep colors={colors} onContinue={() => goTo('limit')} setError={setError} error={error} />
        ) : null}
        {step === 'limit' ? (
          <LimitStep colors={colors} onContinue={() => goTo('card')} setError={setError} error={error} />
        ) : null}
        {step === 'card' ? <CardStep colors={colors} onComplete={finish} setError={setError} error={error} /> : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function BusinessProfileStep({ colors, onContinue, setError, error }: StepProps & { onContinue: () => void }) {
  const { createProfile } = useFinancialProfiles();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.7,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      setImageData(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    } catch {
      Alert.alert('Não foi possível adicionar a imagem', 'Escolha outra imagem e tente novamente.');
    }
  };

  const addBusinessProfile = async () => {
    const trimmedBusinessName = businessName.trim();
    if (!trimmedBusinessName) {
      setError('Informe o nome da empresa para continuar.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await createProfile({
        type: 'business',
        name: 'Empresarial',
        businessName: trimmedBusinessName,
        imageData,
      }, { activate: false });
      onContinue();
    } catch {
      setError('Não foi possível criar o perfil empresarial. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <>
        <StepHeader
          eyebrow="PERFIL EMPRESARIAL"
          title="Como se chama a empresa?"
          description="O nome empresarial ficará separado do seu nome pessoal."
          colors={colors}
        />
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Nome da empresa</Text>
        <TextInput
          accessibilityLabel="Nome da empresa"
          testID="business-name-input"
          autoCapitalize="words"
          placeholder="Ex.: Estúdio Aurora"
          placeholderTextColor={colors.mutedForeground}
          value={businessName}
          onChangeText={setBusinessName}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={imageData ? 'Trocar imagem da empresa' : 'Adicionar imagem da empresa'}
          onPress={() => void pickImage()}
          style={({ pressed }) => [styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.card }, pressed && styles.pressed]}
        >
          {imageData ? <Image source={{ uri: imageData }} style={styles.businessImage} /> : <Feather name="camera" size={19} color={colors.mutedForeground} />}
          <View style={styles.imagePickerCopy}>
            <Text style={[styles.imagePickerTitle, { color: colors.foreground }]}>{imageData ? 'Trocar imagem' : 'Adicionar imagem'}</Text>
            <Text style={[styles.imagePickerHint, { color: colors.mutedForeground }]}>Opcional · usada apenas no perfil empresarial</Text>
          </View>
        </Pressable>
        <View style={styles.choiceStack}>
          <ChoiceButton
            label={saving ? 'Criando perfil...' : 'Criar perfil empresarial'}
            icon="check"
            onPress={() => void addBusinessProfile()}
            colors={colors}
            secondary={saving}
          />
          <ChoiceButton
            label="Cancelar criação"
            icon="x"
            onPress={() => {
              setCreating(false);
              setBusinessName('');
              setImageData(null);
              setError('');
            }}
            colors={colors}
            secondary
          />
        </View>
        <ErrorMessage message={error} colors={colors} />
      </>
    );
  }

  return (
    <>
      <StepHeader
        eyebrow="PERFIL FINANCEIRO"
        title="Você também controla um negócio?"
        description="Crie um perfil separado para pequenas empresas, autônomos, freelancers e pequenos negócios."
        colors={colors}
      />
      <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={17} color={colors.foreground} />
        <Text style={[styles.noticeText, { color: colors.foreground }]}>
          O perfil empresarial é para controle financeiro operacional. Ele não substitui ERP, sistema comercial ou sistema contábil.
        </Text>
      </View>
      <View style={styles.choiceStack}>
        <ChoiceButton
          label="Sim, criar perfil empresarial"
          icon="briefcase"
          onPress={() => {
            setError('');
            setCreating(true);
          }}
          colors={colors}
        />
        <ChoiceButton label="Agora não" icon="arrow-right" onPress={onContinue} colors={colors} secondary />
      </View>
      <ErrorMessage message={error} colors={colors} />
    </>
  );
}

type StepProps = {
  colors: ReturnType<typeof useColors>;
  setError: (message: string) => void;
  error: string;
};

function NameStep({ colors, onContinue, setError, error }: StepProps & { onContinue: () => void }) {
  const { session, updateProfile } = useAuth();
  const [name, setName] = useState(session?.name.split(' ')[0] ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const firstName = name.trim();
    if (!firstName) {
      setError('Informe seu nome.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await updateProfile(firstName);
      onContinue();
    } catch {
      setError('Não foi possível salvar seu nome. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="VAMOS COMEÇAR"
        title="Como podemos te chamar?"
        description="Seu nome aparecerá na saudação e deixará sua experiência mais pessoal."
        colors={colors}
      />
      <FieldLabel colors={colors}>Seu nome</FieldLabel>
      <TextInput
        autoCapitalize="words"
        autoFocus
        placeholder="Ex.: Felipe"
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />
      <ErrorMessage message={error} colors={colors} />
      <ContinueButton label={saving ? 'Salvando...' : 'Continuar'} onPress={() => void save()} colors={colors} disabled={saving} />
    </>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
  colors,
}: {
  eyebrow: string;
  title: string;
  description: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.header}>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
    </View>
  );
}

function ErrorMessage({ message, colors }: { message: string; colors: ReturnType<typeof useColors> }) {
  return message ? <Text style={[styles.error, { color: colors.expense }]}>{message}</Text> : null;
}

function FieldLabel({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{children}</Text>;
}

function WalletStep({ colors, onContinue, setError, error }: StepProps & { onContinue: () => void }) {
  const { createWallet } = useWallets();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const title = name.trim();
    if (!title) {
      setError('Informe o nome da carteira.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await createWallet({ title, initialBalance: 0 });
      onContinue();
    } catch {
      setError('Não foi possível criar sua carteira. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="VAMOS COMEÇAR"
        title="Onde você tem uma conta?"
        description="Crie sua carteira padrão para acompanhar o saldo e organizar seus lançamentos."
        colors={colors}
      />
      <FieldLabel colors={colors}>Nome da carteira</FieldLabel>
      <TextInput
        autoCapitalize="words"
        autoFocus
        placeholder="Ex.: Nubank, Banco do Brasil..."
        placeholderTextColor={colors.mutedForeground}
        value={name}
        onChangeText={setName}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />
      <ErrorMessage message={error} colors={colors} />
      <ContinueButton label={saving ? 'Criando carteira...' : 'Continuar'} onPress={() => void save()} colors={colors} disabled={saving} />
    </>
  );
}

function GoalStep({ colors, onContinue, setError, error }: StepProps & { onContinue: () => void }) {
  const { createGoal } = useGoals();
  const [choice, setChoice] = useState<'question' | 'form'>('question');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(getSaoPauloToday);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmedTitle = title.trim();
    const numericAmount = parseAmountInput(amount);
    if (!trimmedTitle) {
      setError('Informe o nome do objetivo.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (!deadline) {
      setError('Informe até quando quer alcançar o objetivo.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await createGoal({
        title: trimmedTitle,
        targetAmount: numericAmount,
        imageData: null,
        deadline: createLocalIsoDate(datePickerValue),
      });
      onContinue();
    } catch {
      setError('Não foi possível criar sua meta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="SEU PRÓXIMO PASSO"
        title="Você tem algum objetivo em mente?"
        description="Se quiser, registre uma meta para acompanhar seu progresso desde o primeiro dia."
        colors={colors}
      />
      {choice === 'question' ? (
        <View style={styles.choiceStack}>
          <ChoiceButton label="Sim, quero configurar uma meta" icon="target" onPress={() => setChoice('form')} colors={colors} />
          <ChoiceButton label="Agora não" icon="arrow-right" onPress={onContinue} colors={colors} secondary />
        </View>
      ) : (
        <>
          <FieldLabel colors={colors}>Nome do objetivo</FieldLabel>
          <TextInput
            autoCapitalize="sentences"
            placeholder="Ex.: Viagem, reserva de emergência..."
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
          />
          <FieldLabel colors={colors}>Valor a alcançar</FieldLabel>
          <View style={[styles.amountShell, { backgroundColor: colors.card, borderColor: colors.input }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>R$</Text>
            <TextInput
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={(value) => setAmount(formatAmountInput(value))}
              style={[styles.amountInput, { color: colors.foreground }]}
            />
          </View>
          <FieldLabel colors={colors}>Até quando?</FieldLabel>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePickerOpen(true)}
            style={({ pressed }) => [styles.select, { backgroundColor: colors.card, borderColor: colors.input }, pressed && styles.pressed]}
          >
            <Feather name="calendar" size={17} color={colors.mutedForeground} />
            <Text style={[styles.selectText, { color: deadline ? colors.foreground : colors.mutedForeground }]}>
              {deadline || 'Selecione uma data'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
          <ErrorMessage message={error} colors={colors} />
          <ContinueButton label={saving ? 'Salvando...' : 'Salvar e continuar'} onPress={() => void save()} colors={colors} disabled={saving} />
          <SkipButton label="Pular esta etapa" onPress={onContinue} colors={colors} />
          <DatePickerModal
            visible={datePickerOpen}
            value={datePickerValue}
            eyebrow="PRAZO DA META"
            onClose={() => setDatePickerOpen(false)}
            onConfirm={(date) => {
              setDatePickerValue(date);
              setDeadline(formatDateInput(date));
              setDatePickerOpen(false);
            }}
          />
        </>
      )}
    </>
  );
}

function LimitStep({ colors, onContinue, setError, error }: StepProps & { onContinue: () => void }) {
  const { categories, loading: categoriesLoading, createCategory, updateCategory } = useCategories();
  const { createLimit } = useLimits();
  const [choice, setChoice] = useState<'question' | 'form'>('question');
  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState<string>(CATEGORY_COLORS[0]);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<LimitPeriod>('monthly');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const numericAmount = parseAmountInput(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      let selectedCategoryId = categoryId;
      if (!selectedCategoryId && newCategoryName.trim()) {
        const category = await createCategory({ name: newCategoryName.trim(), color: categoryColor });
        selectedCategoryId = category.id;
      }
      if (!selectedCategoryId) {
        setError('Selecione uma categoria ou crie uma nova.');
        return;
      }
      const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
      if (selectedCategory && selectedCategory.color !== categoryColor) {
        await updateCategory(selectedCategoryId, { color: categoryColor });
      }
      await createLimit({ categoryId: selectedCategoryId, description: null, amount: numericAmount, period });
      onContinue();
    } catch {
      setError('Não foi possível criar seu limite. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="MAIS CONTROLE"
        title="Quer configurar um limite de gastos?"
        description="Defina um valor por categoria para saber quando seus gastos estiverem se aproximando do limite."
        colors={colors}
      />
      {choice === 'question' ? (
        <View style={styles.choiceStack}>
          <ChoiceButton label="Sim, quero configurar" icon="sliders" onPress={() => setChoice('form')} colors={colors} />
          <ChoiceButton label="Agora não" icon="arrow-right" onPress={onContinue} colors={colors} secondary />
        </View>
      ) : (
        <>
          <FieldLabel colors={colors}>Categoria</FieldLabel>
          {categoriesLoading ? (
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Carregando categorias...</Text>
          ) : categories.length > 0 ? (
            <View style={styles.optionsGrid}>
              {categories.map((category) => {
                const selected = category.id === categoryId;
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setCategoryId(category.id);
                      setCategoryColor(category.color);
                    }}
                    style={({ pressed }) => [
                      styles.optionChip,
                      { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.optionChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{category.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {categories.length === 0 ? (
            <TextInput
              autoCapitalize="sentences"
              placeholder="Ex.: Alimentação, transporte..."
              placeholderTextColor={colors.mutedForeground}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
            />
          ) : null}
          <FieldLabel colors={colors}>Cor da categoria</FieldLabel>
          <View style={styles.colorOptions}>
            {CATEGORY_COLORS.map((option) => {
              const selected = categoryColor === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Selecionar cor ${option}`}
                  onPress={() => setCategoryColor(option)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: option, borderColor: selected ? colors.foreground : 'transparent' },
                  ]}
                >
                  {selected ? <Feather name="check" size={15} color={colors.primaryForeground} /> : null}
                </Pressable>
              );
            })}
          </View>
          <FieldLabel colors={colors}>Valor do limite</FieldLabel>
          <View style={[styles.amountShell, { backgroundColor: colors.card, borderColor: colors.input }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>R$</Text>
            <TextInput
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={(value) => setAmount(formatAmountInput(value))}
              style={[styles.amountInput, { color: colors.foreground }]}
            />
          </View>
          <FieldLabel colors={colors}>Período</FieldLabel>
          <View style={styles.optionsGrid}>
            {LIMIT_PERIODS.map((option) => {
              const selected = option.value === period;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => setPeriod(option.value)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.optionChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <ErrorMessage message={error} colors={colors} />
          <ContinueButton label={saving ? 'Salvando...' : 'Salvar e continuar'} onPress={() => void save()} colors={colors} disabled={saving} />
          <SkipButton label="Pular esta etapa" onPress={onContinue} colors={colors} />
        </>
      )}
    </>
  );
}

function CardStep({ colors, onComplete, setError, error }: StepProps & { onComplete: () => void }) {
  const { createCard } = useCards();
  const [choice, setChoice] = useState<'question' | 'form'>('question');
  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [availableLimit, setAvailableLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmedName = name.trim();
    const parsedDueDay = Number(dueDay);
    const parsedClosingDay = Number(closingDay);
    const parsedAvailableLimit = availableLimit.trim() ? parseAmountInput(availableLimit) : null;
    if (!trimmedName) {
      setError('Informe o nome do cartão.');
      return;
    }
    if (!Number.isInteger(parsedClosingDay) || parsedClosingDay < 1 || parsedClosingDay > 31) {
      setError('Informe um dia de fechamento entre 1 e 31.');
      return;
    }
    if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      setError('Informe um dia de vencimento entre 1 e 31.');
      return;
    }
    if (parsedAvailableLimit !== null && (!Number.isFinite(parsedAvailableLimit) || parsedAvailableLimit < 0)) {
      setError('Confira o limite disponível informado.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await createCard({
        name: trimmedName,
        dueDay: parsedDueDay,
        closingDay: parsedClosingDay,
        availableLimit: parsedAvailableLimit,
      });
      onComplete();
    } catch {
      setError('Não foi possível criar seu cartão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="ÚLTIMA ETAPA"
        title="Quer organizar suas faturas?"
        description="Cadastre um cartão de crédito para acompanhar compras, fechamento e pagamento da fatura."
        colors={colors}
      />
      {choice === 'question' ? (
        <View style={styles.choiceStack}>
          <ChoiceButton label="Sim, cadastrar cartão" icon="credit-card" onPress={() => setChoice('form')} colors={colors} />
          <ChoiceButton label="Agora não" icon="check" onPress={onComplete} colors={colors} secondary />
        </View>
      ) : (
        <>
          <FieldLabel colors={colors}>Nome do cartão</FieldLabel>
          <TextInput
            autoCapitalize="words"
            placeholder="Ex.: Nubank, Visa principal..."
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
          />
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <FieldLabel colors={colors}>Fechamento</FieldLabel>
              <TextInput
                keyboardType="number-pad"
                placeholder="Dia"
                placeholderTextColor={colors.mutedForeground}
                value={closingDay}
                onChangeText={setClosingDay}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
            </View>
            <View style={styles.column}>
              <FieldLabel colors={colors}>Vencimento</FieldLabel>
              <TextInput
                keyboardType="number-pad"
                placeholder="Dia"
                placeholderTextColor={colors.mutedForeground}
                value={dueDay}
                onChangeText={setDueDay}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
            </View>
          </View>
          <FieldLabel colors={colors}>Limite disponível (opcional)</FieldLabel>
          <View style={[styles.amountShell, { backgroundColor: colors.card, borderColor: colors.input }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>R$</Text>
            <TextInput
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              value={availableLimit}
              onChangeText={(value) => setAvailableLimit(formatAmountInput(value))}
              style={[styles.amountInput, { color: colors.foreground }]}
            />
          </View>
          <ErrorMessage message={error} colors={colors} />
          <ContinueButton label={saving ? 'Salvando...' : 'Salvar e ir para o dashboard'} onPress={() => void save()} colors={colors} disabled={saving} />
          <SkipButton label="Pular esta etapa" onPress={onComplete} colors={colors} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 24 },
  brandIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  progressRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4 },
  navigationRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  navigationButton: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelButton: { marginLeft: 'auto' },
  navigationText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  header: { marginBottom: 25 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, marginBottom: 9 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  description: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 12 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 15 },
  input: { minHeight: 50, borderRadius: 9, borderWidth: 1, paddingHorizontal: 13, fontSize: 14, fontFamily: 'Inter_400Regular' },
  imagePicker: { minHeight: 66, borderRadius: 9, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  businessImage: { width: 44, height: 44, borderRadius: 8 },
  imagePickerCopy: { flex: 1, minWidth: 0 },
  imagePickerTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  imagePickerHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  amountShell: { minHeight: 50, borderRadius: 9, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginRight: 7 },
  amountInput: { flex: 1, minHeight: 48, paddingVertical: 0, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  select: { minHeight: 50, borderRadius: 9, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  choiceStack: { gap: 10, marginTop: 8 },
  choiceButton: { minHeight: 54, borderRadius: 9, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceButtonText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  continueButton: { minHeight: 50, borderRadius: 9, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 },
  continueButtonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  skipButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  skipButtonText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { minHeight: 38, borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  optionChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  colorOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 2 },
  colorOption: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  error: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 9 },
  notice: { borderWidth: 1, borderRadius: 9, padding: 12, flexDirection: 'row', gap: 9, marginTop: 4 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  pressed: { opacity: 0.72 },
});
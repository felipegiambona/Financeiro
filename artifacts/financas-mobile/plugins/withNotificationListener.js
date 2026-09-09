const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DEFAULT_PACKAGE = 'com.financas.mobile';
const NATIVE_FILES = [
  'FinancasNotificationListenerModule.java',
  'FinancasNotificationListenerPackage.java',
  'FinancasNotificationListenerService.java',
  'NotificationParser.java',
  'NotificationStore.java',
];

function getPackageName(config) {
  return config.android?.package || DEFAULT_PACKAGE;
}

function withNotificationManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const packageName = getPackageName(modConfig);
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    const serviceName = `${packageName}.notification.FinancasNotificationListenerService`;
    const services = application.service ?? [];
    const existing = services.find((service) => service.$?.['android:name'] === serviceName);
    if (!existing) {
      services.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'true',
          'android:label': 'Finanças Mobile',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.service.notification.NotificationListenerService' } },
            ],
          },
        ],
      });
    }
    application.service = services;
    return modConfig;
  });
}

function withNotificationNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const packageName = getPackageName(modConfig);
      const packagePath = packageName.split('.').join(path.sep);
      const destination = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'notification',
      );
      const source = path.join(__dirname, '..', 'native', 'notification');
      fs.mkdirSync(destination, { recursive: true });
      for (const fileName of NATIVE_FILES) {
        fs.copyFileSync(path.join(source, fileName), path.join(destination, fileName));
      }
      return modConfig;
    },
  ]);
}

function withNotificationPackage(config) {
  return withMainApplication(config, (modConfig) => {
    const packageName = getPackageName(modConfig);
    const importLine = `import ${packageName}.notification.FinancasNotificationListenerPackage`;
    let contents = modConfig.modResults.contents;
    if (!contents.includes(importLine)) {
      contents = contents.replace(/(package [^\n]+\n)/, `$1\n${importLine}\n`);
    }

    if (contents.includes('PackageList(this).packages.apply {')) {
      contents = contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n      add(FinancasNotificationListenerPackage())',
      );
    } else if (contents.includes('new PackageList(this).getPackages()')) {
      contents = contents.replace(
        'List<ReactPackage> packages = new PackageList(this).getPackages();',
        'List<ReactPackage> packages = new PackageList(this).getPackages();\n    packages.add(new FinancasNotificationListenerPackage());',
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = function withNotificationListener(config) {
  config = withNotificationManifest(config);
  config = withNotificationNativeFiles(config);
  config = withNotificationPackage(config);
  return config;
};
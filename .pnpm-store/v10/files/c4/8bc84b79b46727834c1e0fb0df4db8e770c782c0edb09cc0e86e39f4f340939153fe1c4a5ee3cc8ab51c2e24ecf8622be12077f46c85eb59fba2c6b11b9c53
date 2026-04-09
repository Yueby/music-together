declare const iconLibraries: {
    readonly lucide: {
        readonly name: "lucide";
        readonly title: "Lucide";
        readonly packages: readonly ["lucide-react"];
        readonly import: "import { ICON } from 'lucide-react'";
        readonly usage: "<ICON />";
        readonly export: "lucide-react";
    };
    readonly tabler: {
        readonly name: "tabler";
        readonly title: "Tabler Icons";
        readonly packages: readonly ["@tabler/icons-react"];
        readonly import: "import { ICON } from '@tabler/icons-react'";
        readonly usage: "<ICON />";
        readonly export: "@tabler/icons-react";
    };
    readonly hugeicons: {
        readonly name: "hugeicons";
        readonly title: "HugeIcons";
        readonly packages: readonly ["@hugeicons/react", "@hugeicons/core-free-icons"];
        readonly import: "import { HugeiconsIcon } from '@hugeicons/react'\nimport { ICON } from '@hugeicons/core-free-icons';";
        readonly usage: "<HugeiconsIcon icon={ICON} strokeWidth={2} />";
        readonly export: "@hugeicons/core-free-icons";
    };
    readonly phosphor: {
        readonly name: "phosphor";
        readonly title: "Phosphor Icons";
        readonly packages: readonly ["@phosphor-icons/react"];
        readonly import: "import { ICON } from '@phosphor-icons/react'";
        readonly usage: "<ICON strokeWidth={2} />";
        readonly export: "@phosphor-icons/react";
    };
    readonly remixicon: {
        readonly name: "remixicon";
        readonly title: "Remix Icon";
        readonly packages: readonly ["@remixicon/react"];
        readonly import: "import { ICON } from '@remixicon/react'";
        readonly usage: "<ICON />";
        readonly export: "@remixicon/react";
    };
};
type IconLibraries = typeof iconLibraries;
type IconLibrary = IconLibraries[keyof IconLibraries];
type IconLibraryName = keyof IconLibraries;

export { type IconLibraries, type IconLibrary, type IconLibraryName, iconLibraries };

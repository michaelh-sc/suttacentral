import { html } from '@polymer/lit-element';

export const languageBaseMenuCss = html`
<style>
      :host {
        --primary-color: var(--sc-primary-color);
        --paper-menu-button-content: {
          display: block;
        };
      }

      .language-menu-dropdown {
        @apply --sc-skolar-font-size-md;
        background-color: transparent;
        --paper-input-container-focus-color: var(--sc-primary-accent-color);
        --paper-dropdown-menu-icon: {
          color: var(--sc-disabled-text-color);
        };
        --paper-dropdown-menu-input: {
          --paper-input-container-input-color: var(--sc-primary-text-color);
          --paper-input-container-color: var(--sc-secondary-text-color);
        };
        --paper-menu-button-dropdown: {
          @apply --sc-shadow-elevation-9dp;
          width: 180px;
          background-color: var(--sc-secondary-background-color);
        };
      }

      .language-menu-list {
        background-color: var(--sc-secondary-background-color);
      }

      .language-menu-paper-item {
        @apply --sc-skolar-font-size-md;
        color: var(--sc-primary-text-color);
         --paper-item-icon-width: 40px;
      }

      .language-menu-paper-item:hover {
        background-color: var(--sc-tertiary-background-color);
        cursor: pointer;
      }

      .language-name {
        padding-top: var(--sc-size-xxs);
      }

      .language-menu-paper-item::before {
        background-color:var(--sc-disabled-text-color);

        color: var(--sc-tertiary-text-color);
        font-weight: 800;
        width: var(--sc-size-md-larger);
        height: 20px;
        line-height: 20px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        display: inline-block;
        text-align: center;
        font-size:14px;
        position:absolute;
        margin-top:1px;
        --notchSize: 4px;
        clip-path: 
    polygon(
      0% var(--notchSize), 
      var(--notchSize) 0%, 
      calc(100% - var(--notchSize)) 0%, 
      100% var(--notchSize), 
      100% calc(100% - var(--notchSize)), 
      calc(100% - var(--notchSize)) 100%, 
      var(--notchSize) 100%, 
      0% calc(100% - var(--notchSize))
    );
      }

      #jpn::before, #sld::before, #kln::before{
        letter-spacing: 0;
        font-size: 12px
      }

      #af::before {
    content: "af";
}

    #ar::before {
    content: "ar";
}

    #au::before {
    content: "au";
}

    #bn::before {
    content: "bn";
}

    #ca::before {
    content: "ca";
}

    #cs::before {
    content: "cs";
}

    #de::before {
    content: "de";
}

    #en::before {
    content: "en";
}

    #ev::before {
    content: "ev";
}

    #kln::before {
    content: "kln";
}

    #vu::before {
    content: "vu";
}

    #es::before {
    content: "es";
}

    #fa::before {
    content: "fa";
}

    #fi::before {
    content: "fi";
}

    #fr::before {
    content: "fr";
}

    #he::before {
    content: "he";
}

    #hi::before {
    content: "hi";
}

    #hu::before {
    content: "hu";
}

    #id::before {
    content: "id";
}

    #it::before {
    content: "it";
}

    #jpn::before {
    content: "jpn";
}

    #ko::before {
    content: "ko";
}

    #nl::before {
    content: "nl";
}

    #no::before {
    content: "no";
}

    #pl::before {
    content: "pl";
}

    #pt::before {
    content: "pt";
}

    #ru::before {
    content: "ru";
}

    #si::before {
    content: "si";
}

    #sl::before {
    content: "sl";
}

    #sld::before {
    content: "sld";
}

    #sr::before {
    content: "sr";
}

    #sv::before {
    content: "sv";
}

    #ta::before {
    content: "ta";
}

    #th::before {
    content: "th";
}

    #vi::before {
    content: "vi";
}

    #zh::before {
    content: "zh";
}

    #my::before {
    content: "my";
}

    #mr::before {
    content: "mr";
}

    #ro::before {
    content: "ro";
}

    #la::before {
    content: "la";
}

</style>
`;
